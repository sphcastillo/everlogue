/**
 * scripts/import-jenna.ts
 *
 * Run:
 *   pnpm tsx scripts/import-jenna.ts
 *   pnpm tsx scripts/import-jenna.ts --source-only  # preview without Sanity writes
 *
 * Appends only picks newer than the latest selection already on the collection.
 * Existing Jenna entries and cataloged books are not rewritten.
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

function monthYearFromJennaDate(value?: string) {
  const match = value?.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})$/i,
  )
  if (!match) return {}
  const month = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()
  return {month, year: Number(match[2])}
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

  const existing = await sanity.fetch<{
    _id?: string
    books?: {selectionNumber?: number; book?: {_ref?: string}}[]
  } | null>(`*[_id == $id][0]{_id, books[]{selectionNumber, book}}`, {id: COLLECTION_ID})

  const existingBooks = existing?.books || []
  const latestExisting = existingBooks.reduce(
    (latest, entry) => Math.max(latest, entry.selectionNumber || 0),
    0,
  )
  const alreadyOnList = new Set(
    existingBooks.map((entry) => entry.book?._ref).filter((id): id is string => Boolean(id)),
  )
  const newPicks = JENNA_PICKS.filter((pick) => pick.selectionNumber > latestExisting)

  console.log(
    `\nExisting Jenna selections: ${existingBooks.length}. Latest #${latestExisting || 0}. New to add: ${newPicks.length}.`,
  )

  if (!existing?._id) {
    throw new Error(
      'Read With Jenna collection is missing. Create it in Studio first so this importer can only append new picks.',
    )
  }

  if (!newPicks.length) {
    console.log('Nothing newer than the current list. Collection left unchanged.')
    return
  }

  const results: ImportResult[] = []

  for (const pick of newPicks) {
    const result = await importPick(pick)
    results.push(result)
    await sleep(150)
  }

  const successful = results.filter(
    (result) =>
      (result.status === 'created' || result.status === 'existing') && result.bookId,
  )

  const needsReview = results.filter(
    (result) => result.status === 'needs-review' || result.status === 'error',
  )

  console.log('\n=======================================')
  console.log('New pick import complete')
  console.log(`Resolved: ${successful.length}/${newPicks.length}`)
  console.log(`Needs review: ${needsReview.length}`)

  const additions = successful
    .filter((result) => result.bookId && !alreadyOnList.has(result.bookId))
    .sort((a, b) => a.selectionNumber - b.selectionNumber)
    .map((result) => {
      const sourcePick = newPicks.find((pick) => pick.selectionNumber === result.selectionNumber)
      const selectionDate = result.selectionDate || sourcePick?.selectionDate
      return {
        _key: `jenna-${String(result.selectionNumber).padStart(3, '0')}`,
        _type: 'curatedCollectionEntry',
        selectionNumber: result.selectionNumber,
        ...(selectionDate
          ? {selectionDate, ...monthYearFromJennaDate(selectionDate)}
          : {}),
        book: {
          _type: 'reference',
          _ref: result.bookId!,
        },
      }
    })

  if (!additions.length) {
    throw new Error(
      `Could not resolve ${newPicks.map((pick) => pick.title).join(', ')}. Existing Jenna selections were not changed.`,
    )
  }

  await sanity
    .patch(COLLECTION_ID)
    .insert('after', 'books[-1]', additions)
    .set({
      totalSelections: existingBooks.length + additions.length,
      lastSyncedAt: new Date().toISOString(),
    })
    .commit()

  console.log(
    `\n✓ Appended ${additions.length} new Jenna selection${additions.length === 1 ? '' : 's'} without rewriting the existing list.`,
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