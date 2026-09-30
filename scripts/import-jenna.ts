/**
 * scripts/import-jenna.ts
 *
 * Run:
 *   pnpm tsx scripts/import-jenna.ts
 *   pnpm tsx scripts/import-jenna.ts --source-only  # preview without Sanity writes
 *
 * Required env:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_WRITE_TOKEN
 *
 * Optional:
 *   GOOGLE_BOOKS_API_KEY
 *
 * Dependency:
 *   pnpm add cheerio
 */

import {config} from 'dotenv'
import {createClient} from '@sanity/client'
import {createHash} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {parseJennaPicks, type JennaPick} from './lib/jenna-source'
import {canonicalJennaTitle, searchJennaBooks} from './lib/jenna-matching'

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------

config({
  path: ['.env.local', '.env'],
  quiet: true,
})

const PROJECT_ID =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID

const DATASET =
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  'production'

const TOKEN =
  process.env.SANITY_API_WRITE_TOKEN

const GOOGLE_BOOKS_API_KEY =
  process.env.GOOGLE_BOOKS_API_KEY

const sourceOnly = process.argv.includes('--source-only')

if (!PROJECT_ID && !sourceOnly) {
  throw new Error(
    'Missing NEXT_PUBLIC_SANITY_PROJECT_ID',
  )
}

if (!TOKEN && !sourceOnly) {
  throw new Error(
    'Missing SANITY_API_WRITE_TOKEN',
  )
}

const sanity = createClient({
  projectId: PROJECT_ID || 'source-preview',
  dataset: DATASET,
  apiVersion: '2026-09-01',
  token: TOKEN,
  useCdn: false,
})

// Change if your schema uses different names.
const BOOK_TYPE = 'book'
const COLLECTION_TYPE = 'curatedCollection'

const COLLECTION_ID =
  'curatedCollection.read-with-jenna'

const JENNA_SOURCE_URL =
  'https://www.today.com/shop/read-jenna-book-club-list-today-s-jenna-bush-hager-t164652'

const MIN_MATCH_SCORE = 80

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

type GoogleIndustryIdentifier = {
  type?: string
  identifier?: string
}

type GoogleVolumeInfo = {
  title?: string
  subtitle?: string
  authors?: string[]

  publisher?: string
  publishedDate?: string

  description?: string

  industryIdentifiers?:
    GoogleIndustryIdentifier[]

  pageCount?: number
  categories?: string[]

  averageRating?: number
  ratingsCount?: number

  imageLinks?: {
    smallThumbnail?: string
    thumbnail?: string
    small?: string
    medium?: string
    large?: string
    extraLarge?: string
  }

  language?: string

  previewLink?: string
  infoLink?: string
  canonicalVolumeLink?: string
}

type GoogleBook = {
  id: string
  volumeInfo?: GoogleVolumeInfo
}

type ScoredCandidate = {
  book: GoogleBook
  score: number
}

type ImportStatus =
  | 'created'
  | 'existing'
  | 'needs-review'
  | 'error'

type ImportResult = {
  selectionNumber: number

  title: string
  requestedAuthors: string[]

  selectionDate?: string

  matchedTitle?: string
  matchedAuthors?: string[]

  googleBooksId?: string
  score?: number

  bookId?: string

  status: ImportStatus

  error?: string

  candidates?: Array<{
    googleBooksId: string
    title?: string
    authors?: string[]
    score: number
  }>
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function normalize(
  value?: string | null,
) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .replace(/[’‘]/g, "'")
    .replace(/&/g, 'and')
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeTitle(
  value?: string | null,
) {
  return normalize(value)
    .replace(/^a\s+/, '')
    .replace(/^an\s+/, '')
    .replace(/^the\s+/, '')
}

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  )
}

function shortHash(
  value: string,
) {
  return createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 24)
}

function isbnOf(
  book: GoogleBook,
  type: 'ISBN_10' | 'ISBN_13',
) {
  return book.volumeInfo
    ?.industryIdentifiers
    ?.find(
      (identifier) =>
        identifier.type === type,
    )
    ?.identifier
}

function bestImage(
  book: GoogleBook,
) {
  const images =
    book.volumeInfo?.imageLinks

  if (!images) {
    return undefined
  }

  return (
    images.extraLarge ??
    images.large ??
    images.medium ??
    images.small ??
    images.thumbnail ??
    images.smallThumbnail
  )?.replace(
    /^http:/,
    'https:',
  )
}

async function fetchTodayHtml() {
  const response = await fetch(
    JENNA_SOURCE_URL,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 EverlogueBookImporter/1.0',

        Accept:
          'text/html,application/xhtml+xml',
      },
    },
  )

  if (!response.ok) {
    throw new Error(
      `TODAY request failed: ` +
        `${response.status} ` +
        `${response.statusText}`,
    )
  }

  return response.text()
}

async function scrapeJennaPicks(): Promise<JennaPick[]> {
  console.log('Fetching official Read With Jenna list...')
  return parseJennaPicks(await fetchTodayHtml())
}

// ---------------------------------------------------------
// Google Books
// ---------------------------------------------------------

async function searchGoogleBooks(pick: JennaPick): Promise<GoogleBook[]> {
  return searchJennaBooks(pick, (book) => scoreBook(pick, book), {key: GOOGLE_BOOKS_API_KEY})
}

// ---------------------------------------------------------
// Google Books match scoring
// ---------------------------------------------------------

const SUSPICIOUS_TERMS = [
  'study guide',
  'summary',
  'analysis',
  'workbook',
  'companion',
  'review guide',
  'book summary',
  'discussion guide',
]

function scoreBook(
  pick: JennaPick,
  book: GoogleBook,
): number {
  const requestedTitle =
    normalizeTitle(
      pick.title,
    )

  const actualTitle =
    normalizeTitle(
      book.volumeInfo?.title,
    )

  const requestedAuthors =
    pick.authors.map(
      normalize,
    )

  const actualAuthors =
    (
      book.volumeInfo
        ?.authors ?? []
    ).map(normalize)

  const exactIsbn = Boolean(pick.isbn && [isbnOf(book, 'ISBN_10'), isbnOf(book, 'ISBN_13')].includes(pick.isbn))
  const authorMatches = requestedAuthors.some((author) => actualAuthors.some((actual) => actual === author || actual.includes(author) || author.includes(actual)))
  if (!exactIsbn && !authorMatches) return 0
  let score = exactIsbn ? 100 : 0

  // -------------------------------------------------------
  // Title
  // -------------------------------------------------------

  if (
    actualTitle &&
    actualTitle ===
      requestedTitle
  ) {
    score += 70
  } else if (
    actualTitle &&
    (
      actualTitle.includes(
        requestedTitle,
      ) ||
      requestedTitle.includes(
        actualTitle,
      )
    )
  ) {
    score += 45
  }

  // -------------------------------------------------------
  // Authors
  // -------------------------------------------------------

  for (
    const requestedAuthor
    of requestedAuthors
  ) {
    if (
      actualAuthors.some(
        (actualAuthor) =>
          actualAuthor ===
          requestedAuthor,
      )
    ) {
      score += 25
      break
    }

    if (
      actualAuthors.some(
        (actualAuthor) =>
          actualAuthor.includes(
            requestedAuthor,
          ) ||
          requestedAuthor.includes(
            actualAuthor,
          ),
      )
    ) {
      score += 15
      break
    }
  }

  // -------------------------------------------------------
  // Prefer complete editions
  // -------------------------------------------------------

  if (
    isbnOf(
      book,
      'ISBN_13',
    )
  ) {
    score += 5
  }

  if (
    isbnOf(
      book,
      'ISBN_10',
    )
  ) {
    score += 3
  }

  if (
    book.volumeInfo
      ?.description
  ) {
    score += 2
  }

  if (
    book.volumeInfo
      ?.pageCount
  ) {
    score += 2
  }

  if (
    book.volumeInfo
      ?.publisher
  ) {
    score += 2
  }

  if (
    bestImage(book)
  ) {
    score += 2
  }

  // -------------------------------------------------------
  // Penalize summaries / unofficial companions
  // -------------------------------------------------------

  const searchable =
    normalize(
      [
        book.volumeInfo
          ?.title,

        book.volumeInfo
          ?.subtitle,

        ...(
          book.volumeInfo
            ?.authors ??
          []
        ),
      ]
        .filter(Boolean)
        .join(' '),
    )

  if (
    SUSPICIOUS_TERMS.some(
      (term) =>
        searchable.includes(
          normalize(term),
        ),
    )
  ) {
    score -= 50
  }

  return score
}

function rankCandidates(
  pick: JennaPick,
  books: GoogleBook[],
): ScoredCandidate[] {
  return books
    .map(
      (book) => ({
        book,

        score:
          scoreBook(
            pick,
            book,
          ),
      }),
    )
    .sort(
      (a, b) =>
        b.score - a.score,
    )
}

// ---------------------------------------------------------
// Existing Everlogue book lookup
// ---------------------------------------------------------

async function findExistingBook(
  book: GoogleBook,
) {
  const isbn13 =
    isbnOf(
      book,
      'ISBN_13',
    )

  const isbn10 =
    isbnOf(
      book,
      'ISBN_10',
    )

  const title =
    book.volumeInfo
      ?.title

  const firstAuthor =
    book.volumeInfo
      ?.authors?.[0]

  const exact = await sanity.fetch<{
    _id: string
  } | null>(
    `*[
      _type == $bookType &&
      (
        googleBooksId == $googleBooksId ||

        (
          defined($isbn13) &&
          isbn13 == $isbn13
        ) ||

        (
          defined($isbn10) &&
          isbn10 == $isbn10
        ) ||

        (
          lower(title) == lower($title) &&
          authors[0] == $firstAuthor
        )
      )
    ][0]{
      _id
    }`,
    {
      bookType:
        BOOK_TYPE,

      googleBooksId:
        book.id,

      isbn13:
        isbn13 ?? null,

      isbn10:
        isbn10 ?? null,

      title:
        title ?? '',

      firstAuthor:
        firstAuthor ?? '',
    },
  )
  if (exact) return exact
  const sameAuthor = await sanity.fetch<{_id: string; title: string}[]>(
    `*[_type == $bookType && lower(authors[0]) == lower($author)] | order(_createdAt asc){_id, title}`,
    {bookType: BOOK_TYPE, author: firstAuthor || ''},
  )
  return sameAuthor.find((candidate) => canonicalJennaTitle(candidate.title) === canonicalJennaTitle(title || '')) || null

}

// ---------------------------------------------------------
// Make Sanity book
// ---------------------------------------------------------

function makeBookDocument(
  book: GoogleBook,
) {
  const info =
    book.volumeInfo ?? {}

  const isbn13 =
    isbnOf(
      book,
      'ISBN_13',
    )

  const isbn10 =
    isbnOf(
      book,
      'ISBN_10',
    )

  const stableIdentity =
    isbn13 ??
    isbn10 ??
    `google-${book.id}`

  const documentId =
    `book.google.${shortHash(
      stableIdentity,
    )}`

  const coverUrl =
    bestImage(book)

  return {
    _id:
      documentId,

    _type:
      BOOK_TYPE,

    catalogReviewStatus: 'needsReview',
    catalogSource: 'bookClubImport',

    title:
      info.title ??
      'Untitled',

    ...(info.subtitle
      ? {
          subtitle:
            info.subtitle,
        }
      : {}),

    authors:
      info.authors ??
      [],

    ...(isbn13
      ? {isbn13}
      : {}),

    ...(isbn10
      ? {isbn10}
      : {}),

    googleBooksId:
      book.id,

    ...(info.description
      ? {
          description:
            info.description,
        }
      : {}),

    ...(info.publisher
      ? {
          publisher:
            info.publisher,
        }
      : {}),

    ...(info.publishedDate
      ? {
          publishedDate:
            info.publishedDate,
        }
      : {}),

    ...(
      typeof info.pageCount ===
      'number'
        ? {
            pageCount:
              info.pageCount,
          }
        : {}
    ),

    ...(info.categories
      ?.length
      ? {
          categories:
            info.categories,
        }
      : {}),

    ...(info.language
      ? {
          language:
            info.language,
        }
      : {}),

    ...(
      typeof info.averageRating ===
      'number'
        ? {
            googleAverageRating:
              info.averageRating,
          }
        : {}
    ),

    ...(
      typeof info.ratingsCount ===
      'number'
        ? {
            googleRatingsCount:
              info.ratingsCount,
          }
        : {}
    ),

    ...(coverUrl
      ? {
          cover: {
            url:
              coverUrl,
          },
        }
      : {}),

    externalLinks: {
      ...(info.previewLink
        ? {
            googlePreview:
              info.previewLink,
          }
        : {}),

      ...(info.infoLink
        ? {
            googleBooks:
              info.infoLink,
          }
        : {}),

      ...(info.canonicalVolumeLink
        ? {
            googleCanonical:
              info.canonicalVolumeLink,
          }
        : {}),
    },

    dataSource: {
      provider:
        'googleBooks',

      providerId:
        book.id,

      importedAt:
        new Date()
          .toISOString(),
    },
  }
}

// ---------------------------------------------------------
// Import one Jenna selection
// ---------------------------------------------------------

async function importPick(
  pick: JennaPick,
): Promise<ImportResult> {
  console.log(
    `\n#${pick.selectionNumber} ` +
      `${pick.title} — ` +
      `${
        pick.authors.join(', ') ||
        'author not listed by TODAY; matching by ISBN'
      }` +
      `${
        pick.selectionDate
          ? ` (${pick.selectionDate})`
          : ''
      }`,
  )

  try {
    const books =
      await searchGoogleBooks(
        pick,
      )

    if (!books.length) {
      console.log(
        '  ✗ No Google Books results',
      )

      return {
        selectionNumber:
          pick.selectionNumber,

        title:
          pick.title,

        requestedAuthors:
          pick.authors,

        selectionDate:
          pick.selectionDate,

        status:
          'needs-review',
      }
    }

    const ranked =
      rankCandidates(
        pick,
        books,
      )

    const best =
      ranked[0]

    if (!best) {
      return {
        selectionNumber:
          pick.selectionNumber,

        title:
          pick.title,

        requestedAuthors:
          pick.authors,

        selectionDate:
          pick.selectionDate,

        status:
          'needs-review',
      }
    }

    console.log(
      `  Best match: ${
        best.book
          .volumeInfo
          ?.title
      }`,
    )

    console.log(
      `  Authors: ${
        best.book
          .volumeInfo
          ?.authors
          ?.join(', ') ??
        'unknown'
      }`,
    )

    console.log(
      `  Match points: ${best.score} (not a percentage)`,
    )

    // -----------------------------------------------------
    // Reject questionable Google matches
    // -----------------------------------------------------

    if (
      best.score <
      MIN_MATCH_SCORE
    ) {
      console.log(
        `  ⚠ Score below ${MIN_MATCH_SCORE}. ` +
          `Needs manual review.`,
      )

      return {
        selectionNumber:
          pick.selectionNumber,

        title:
          pick.title,

        requestedAuthors:
          pick.authors,

        selectionDate:
          pick.selectionDate,

        matchedTitle:
          best.book
            .volumeInfo
            ?.title,

        matchedAuthors:
          best.book
            .volumeInfo
            ?.authors,

        googleBooksId:
          best.book.id,

        score:
          best.score,

        status:
          'needs-review',

        candidates:
          ranked
            .slice(0, 5)
            .map(
              (
                candidate,
              ) => ({
                googleBooksId:
                  candidate
                    .book
                    .id,

                title:
                  candidate
                    .book
                    .volumeInfo
                    ?.title,

                authors:
                  candidate
                    .book
                    .volumeInfo
                    ?.authors,

                score:
                  candidate
                    .score,
              }),
            ),
      }
    }

    // -----------------------------------------------------
    // Reuse existing Everlogue books
    // -----------------------------------------------------

    const existing =
      await findExistingBook(
        best.book,
      )

    if (existing) {
      console.log(
        `  ✓ Existing Everlogue book: ${existing._id}`,
      )

      return {
        selectionNumber:
          pick.selectionNumber,

        title:
          pick.title,

        requestedAuthors:
          pick.authors,

        selectionDate:
          pick.selectionDate,

        matchedTitle:
          best.book
            .volumeInfo
            ?.title,

        matchedAuthors:
          best.book
            .volumeInfo
            ?.authors,

        googleBooksId:
          best.book.id,

        score:
          best.score,

        bookId:
          existing._id,

        status:
          'existing',
      }
    }

    // -----------------------------------------------------
    // Create new Everlogue book
    // -----------------------------------------------------

    const document =
      makeBookDocument(
        best.book,
      )

    /**
     * Safe to rerun.
     *
     * We don't want a later Jenna import to wipe out
     * editorial improvements you've made to a book.
     */
    await sanity
      .createIfNotExists(
        document,
      )

    console.log(
      `  ✓ Created ${document._id}`,
    )

    return {
      selectionNumber:
        pick.selectionNumber,

      title:
        pick.title,

      requestedAuthors:
        pick.authors,

      selectionDate:
        pick.selectionDate,

      matchedTitle:
        best.book
          .volumeInfo
          ?.title,

      matchedAuthors:
        best.book
          .volumeInfo
          ?.authors,

      googleBooksId:
        best.book.id,

      score:
        best.score,

      bookId:
        document._id,

      status:
        'created',
    }
  } catch (error) {
    console.error(
      '  ✗',
      error,
    )

    return {
      selectionNumber:
        pick.selectionNumber,

      title:
        pick.title,

      requestedAuthors:
        pick.authors,

      selectionDate:
        pick.selectionDate,

      status:
        'error',

      error:
        error instanceof Error
          ? error.message
          : String(error),
    }
  }
}

// ---------------------------------------------------------
// Main
// ---------------------------------------------------------

async function main() {
  console.log(
    'Everlogue — Read With Jenna importer',
  )

  console.log(
    '=======================================',
  )

  // -------------------------------------------------------
  // Step 1: Scrape official TODAY list
  // -------------------------------------------------------

  const JENNA_PICKS =
    await scrapeJennaPicks()

  console.log(
    `Selections discovered: ${JENNA_PICKS.length}`,
  )

  if (
    JENNA_PICKS.length === 0
  ) {
    throw new Error(
      'No Read With Jenna picks were discovered.',
    )
  }

  /**
   * As of September 2026 the complete list is around 90+
   * selections.
   *
   * Don't hardcode exactly 91 because this importer should
   * keep working as Jenna adds books.
   *
   * But if TODAY suddenly returns 12 books, don't let the
   * script overwrite your complete Sanity collection.
   */
  if (
    JENNA_PICKS.length < 80
  ) {
    throw new Error(
      `Only ${JENNA_PICKS.length} Read With Jenna ` +
        `picks were found. Expected at least 80. ` +
        `TODAY's page structure may have changed.`,
    )
  }

  // -------------------------------------------------------
  // Source snapshot
  // -------------------------------------------------------

  await writeFile(
    'jenna-source-picks.json',
    JSON.stringify(
      JENNA_PICKS,
      null,
      2,
    ),
  )

  console.log(
    '✓ Wrote jenna-source-picks.json',
  )

  if (sourceOnly) return

  // -------------------------------------------------------
  // Step 2: Google Books + Sanity
  // -------------------------------------------------------

  const results:
    ImportResult[] = []

  for (
    const pick
    of JENNA_PICKS
  ) {
    const result =
      await importPick(
        pick,
      )

    results.push(
      result,
    )

    // Easier on Google Books.
    await sleep(150)
  }

  const successful =
    results.filter(
      (result) =>
        (
          result.status ===
            'created' ||
          result.status ===
            'existing'
        ) &&
        result.bookId,
    )

  const needsReview =
    results.filter(
      (result) =>
        result.status ===
          'needs-review' ||
        result.status ===
          'error',
    )

  console.log(
    '\n=======================================',
  )

  console.log(
    'Book import complete',
  )

  console.log(
    `Resolved: ` +
      `${successful.length}/` +
      `${JENNA_PICKS.length}`,
  )

  console.log(
    `Needs review: ` +
      `${needsReview.length}`,
  )

  // -------------------------------------------------------
  // Step 3: Read With Jenna collection
  // -------------------------------------------------------

  const collectionEntries =
    results
      .filter(
        (result) =>
          result.bookId,
      )
      .sort(
        (a, b) =>
          a.selectionNumber -
          b.selectionNumber,
      )
      .map(
        (result) => ({
          _key:
            `jenna-${String(
              result.selectionNumber,
            ).padStart(
              3,
              '0',
            )}`,

          _type:
            'curatedCollectionEntry',

          selectionNumber:
            result.selectionNumber,

          /**
           * Keep this only if your
           * curatedCollectionEntry schema has this field.
           */
          ...(result.selectionDate
            ? {
                selectionDate:
                  result.selectionDate,
              }
            : {}),

          book: {
            _type:
              'reference',

            _ref:
              result.bookId!,
          },
        }),
      )

  const collection = {
    _id:
      COLLECTION_ID,

    _type:
      COLLECTION_TYPE,

    title:
      'Read With Jenna',

    slug: {
      _type: 'slug',
      current:
        'read-with-jenna',
    },

    collectionType:
      'celebrityBookClub',

    curator: {
      name:
        'Jenna Bush Hager',
    },

    description:
      "Explore Jenna Bush Hager's Read With Jenna selections from the beginning of the book club to the latest pick.",

    source: {
      name:
        'Read With Jenna',

      url:
        JENNA_SOURCE_URL,
    },

    totalSelections:
      JENNA_PICKS.length,

    books:
      collectionEntries,

    lastSyncedAt:
      new Date()
        .toISOString(),
  }

  /**
   * The collection is externally controlled by the
   * official TODAY list, so replacement is intentional.
   *
   * Individual books use createIfNotExists above.
   */
  await sanity
    .createOrReplace(
      collection,
    )

  console.log(
    `\n✓ Read With Jenna collection saved with ` +
      `${collectionEntries.length}/` +
      `${JENNA_PICKS.length} resolved selections`,
  )

  // -------------------------------------------------------
  // Step 4: Review report
  // -------------------------------------------------------

  const report = {
    generatedAt:
      new Date()
        .toISOString(),

    source:
      JENNA_SOURCE_URL,

    requestedSelections:
      JENNA_PICKS.length,

    resolvedSelections:
      successful.length,

    needsReview:
      needsReview.length,

    results,
  }

  await writeFile(
    'jenna-import-report.json',
    JSON.stringify(
      report,
      null,
      2,
    ),
  )

  console.log(
    '✓ Wrote jenna-import-report.json',
  )

  if (
    needsReview.length
  ) {
    console.log(
      '\nSome titles need manual verification.',
    )

    console.log(
      'Nothing low-confidence was inserted.',
    )

    process.exitCode = 1
  }
}

main().catch(
  (error) => {
    console.error(error)
    process.exit(1)
  },
)