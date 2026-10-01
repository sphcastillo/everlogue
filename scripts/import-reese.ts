import {parseReeseSourcePage} from '../src/lib/book-club-watch/reese-source'
/**
 * scripts/import-reese.ts
 *
 * Run:
 *   pnpm tsx scripts/import-reese.ts
 *
 * Appends only picks newer than the latest selection already on the collection.
 * Existing Reese entries and cataloged books are not rewritten.
 *
 * Required env:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_WRITE_TOKEN
 *
 * Optional:
 *   GOOGLE_BOOKS_API_KEY
 */

import {config} from 'dotenv'
import {createClient} from '@sanity/client'
import {createHash} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {monthName} from '../src/lib/club-selection-dates'

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------

config({path: ['.env.local', '.env'], quiet: true})

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const TOKEN = process.env.SANITY_API_WRITE_TOKEN
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY

if (!PROJECT_ID) {
  throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID')
}

if (!TOKEN) {
  throw new Error('Missing SANITY_API_WRITE_TOKEN')
}

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2026-09-01',
  token: TOKEN,
  useCdn: false,
})

const BOOK_TYPE = 'book'
const COLLECTION_TYPE = 'curatedCollection'

const COLLECTION_ID = 'curatedCollection.reeses-book-club'

const REESE_SOURCE_URL =
  'https://reesesbookclub.com/the-complete-list/'

// How confident Google Books needs to be before we import.
const MIN_MATCH_SCORE = 80

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

type ReesePick = {
  selectionNumber: number
  title: string
  authors: string[]
  selectionDate?: string
  sourceUrl?: string
}

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
  industryIdentifiers?: GoogleIndustryIdentifier[]
  pageCount?: number
  categories?: string[]
  averageRating?: number
  ratingsCount?: number
  maturityRating?: string

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

type GoogleBooksResponse = {
  totalItems?: number
  items?: GoogleBook[]
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

function normalize(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’‘]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeTitle(value?: string | null) {
  return normalize(value)
    .replace(/^a\s+/, '')
    .replace(/^an\s+/, '')
    .replace(/^the\s+/, '')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shortHash(value: string) {
  return createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 24)
}

function monthYearFromSelectionDate(value?: string) {
  if (!value) return {}
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return {}
  const date = new Date(parsed)
  return {
    month: monthName(date.getMonth() + 1),
    year: date.getFullYear(),
  }
}

function isbnOf(
  book: GoogleBook,
  type: 'ISBN_10' | 'ISBN_13',
) {
  return book.volumeInfo?.industryIdentifiers?.find(
    (identifier) => identifier.type === type,
  )?.identifier
}

function bestImage(book: GoogleBook) {
  const images = book.volumeInfo?.imageLinks

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
  )?.replace(/^http:/, 'https:')
}

// ---------------------------------------------------------
// Reese's Book Club scraper
// ---------------------------------------------------------

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 EverlogueBookImporter/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Reese's Book Club request failed: ${response.status} ${response.statusText}`,
    )
  }

  return response.text()
}

/**
 * Pull title / author / date from a Reese Complete List page.
 *
 * Reese currently paginates the Complete List, so we visit pages until
 * there isn't a next page.
 */
async function scrapeReesePicks(): Promise<ReesePick[]> {
  console.log("Fetching Reese's Book Club complete list...")

  const discovered: Array<
    Omit<ReesePick, 'selectionNumber'>
  > = []

  const visited = new Set<string>()

  let pageUrl: string | null = REESE_SOURCE_URL

  while (pageUrl) {
    if (visited.has(pageUrl)) {
      break
    }

    visited.add(pageUrl)

    console.log(`  → ${pageUrl}`)

    const html = await fetchHtml(pageUrl)
    const page = parseReeseSourcePage(html, pageUrl)
    discovered.push(...page.picks)
    pageUrl = page.next ? new URL(page.next, pageUrl).toString() : null

    await sleep(250)
  }

  // -------------------------------------------------------
  // Deduplicate
  // -------------------------------------------------------

  const unique = new Map<
    string,
    Omit<ReesePick, 'selectionNumber'>
  >()

  for (const pick of discovered) {
    const key =
      pick.sourceUrl ??
      `${normalizeTitle(pick.title)}:${normalize(
        pick.authors[0],
      )}`

    if (!unique.has(key)) {
      unique.set(key, pick)
    }
  }

  let picks = [...unique.values()]

  /**
   * Reese's page is newest → oldest.
   *
   * Everlogue collection numbering should be:
   *
   * #1 = oldest
   * latest number = newest
   */
  picks = picks.reverse()

  return picks.map((pick, index) => ({
    ...pick,
    selectionNumber: index + 1,
  }))
}

// ---------------------------------------------------------
// Google Books search
// ---------------------------------------------------------

// Verified editions for source titles that Google cannot reliably find by text.
// Key by title AND author so an override cannot select a different author's book.
const VERIFIED_LOOKUPS = [
  {
    sourceTitle: 'Fair Play: A Game Changing Solution When You Have Too Much To Do (And More Life to Live)',
    author: 'Eve Rodsky',
    title: 'Fair Play',
    isbn13: '9780525541943',
    source: 'https://www.penguinrandomhouse.com/books/605905/fair-play-reeses-book-club-by-eve-rodsky/',
  },
  {
    sourceTitle: 'Furia',
    author: 'Yamile Saied Méndez',
    title: 'Furia',
    isbn13: '9781643751207',
    source: 'https://www.hachettebookgroup.com/titles/yamile-saied-mendez/furia/9781643751207/',
  },
  {
    sourceTitle: 'City of Nightbirds',
    author: 'Juhea Kim',
    title: 'City of Night Birds',
    isbn13: '9780063394759',
    source: 'https://library.ltikorea.or.kr/originalworks/413720',
  },
  {
    sourceTitle: 'Sophie, Standing There',
    author: 'Meg Mason',
    title: 'Sophie, Standing There',
    isbn13: '9780063493131',
    source: 'https://reesesbookclub.com/book/sophie-standing-there/',
  },
]

function verifiedLookup(pick: ReesePick) {
  return VERIFIED_LOOKUPS.find((lookup) =>
    normalize(pick.title) === normalize(lookup.sourceTitle) &&
    pick.authors.some((author) => normalize(author) === normalize(lookup.author)),
  )
}

async function searchGoogleBooks(
  pick: ReesePick,
): Promise<GoogleBook[]> {
  const author = pick.authors[0] ?? ''
  const lookup = verifiedLookup(pick)

  const query = lookup ? `isbn:${lookup.isbn13}` : [
    `intitle:"${pick.title}"`,
    author ? `inauthor:"${author}"` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const params = new URLSearchParams({
    q: query,
    maxResults: '20',
    printType: 'books',
    projection: 'full',
    orderBy: 'relevance',
  })

  if (GOOGLE_BOOKS_API_KEY) {
    params.set('key', GOOGLE_BOOKS_API_KEY)
  }

  const url =
    `https://www.googleapis.com/books/v1/volumes?` +
    params.toString()

  let response: Response | undefined

  for (let attempt = 0; attempt < 6; attempt++) {
    response = await fetch(url)

    if (response.status !== 429) {
      break
    }

    const wait = Math.min(70_000, 8_000 * 2 ** attempt)
    console.log(`  Google Books 429, waiting ${Math.round(wait / 1000)}s`)
    await sleep(wait)
  }

  if (!response?.ok) {
    throw new Error(
      `Google Books failed ${response?.status}: ${response ? await response.text() : 'no response'}`,
    )
  }

  const data =
    (await response.json()) as GoogleBooksResponse

  const items = data.items ?? []
  if (items.length || !lookup) return items

  const fallback = new URLSearchParams({
    q: `intitle:"${lookup.title}" inauthor:"${lookup.author}"`,
    maxResults: '20',
    printType: 'books',
    projection: 'full',
  })
  if (GOOGLE_BOOKS_API_KEY) fallback.set('key', GOOGLE_BOOKS_API_KEY)
  const retry = await fetch(`https://www.googleapis.com/books/v1/volumes?${fallback}`)
  if (!retry.ok) return items
  const retryData = (await retry.json()) as GoogleBooksResponse
  return retryData.items ?? []
}

// ---------------------------------------------------------
// Match scoring
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
  pick: ReesePick,
  book: GoogleBook,
): number {
  const requestedTitle = normalizeTitle(verifiedLookup(pick)?.title ?? pick.title)
  const actualTitle = normalizeTitle(
    book.volumeInfo?.title,
  )

  const requestedAuthors = pick.authors.map(normalize)
  const actualAuthors = (
    book.volumeInfo?.authors ?? []
  ).map(normalize)

  let score = 0

  // -------------------------------------------------------
  // Title
  // -------------------------------------------------------

  if (
    actualTitle &&
    actualTitle === requestedTitle
  ) {
    score += 70
  } else if (
    actualTitle.includes(requestedTitle) ||
    requestedTitle.includes(actualTitle)
  ) {
    score += 45
  }

  // -------------------------------------------------------
  // Author
  // -------------------------------------------------------

  for (const requestedAuthor of requestedAuthors) {
    if (
      actualAuthors.some(
        (actualAuthor) =>
          actualAuthor === requestedAuthor,
      )
    ) {
      score += 25
      break
    }

    if (
      actualAuthors.some(
        (actualAuthor) =>
          actualAuthor.includes(requestedAuthor) ||
          requestedAuthor.includes(actualAuthor),
      )
    ) {
      score += 15
      break
    }
  }

  // -------------------------------------------------------
  // Edition quality
  // -------------------------------------------------------

  if (isbnOf(book, 'ISBN_13')) {
    score += 5
  }

  if (isbnOf(book, 'ISBN_10')) {
    score += 3
  }

  if (book.volumeInfo?.description) {
    score += 2
  }

  if (book.volumeInfo?.pageCount) {
    score += 2
  }

  if (book.volumeInfo?.publisher) {
    score += 2
  }

  if (bestImage(book)) {
    score += 2
  }

  // -------------------------------------------------------
  // Avoid summaries / study guides / companion books
  // -------------------------------------------------------

  const searchableText = normalize(
    [
      book.volumeInfo?.title,
      book.volumeInfo?.subtitle,
      ...(book.volumeInfo?.authors ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  )

  if (
    SUSPICIOUS_TERMS.some((term) =>
      searchableText.includes(normalize(term)),
    )
  ) {
    score -= 50
  }

  return score
}

function rankCandidates(
  pick: ReesePick,
  books: GoogleBook[],
): ScoredCandidate[] {
  return books
    .map((book) => ({
      book,
      score: scoreBook(pick, book),
    }))
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------
// Existing Everlogue book lookup
// ---------------------------------------------------------

async function findExistingBook(
  book: GoogleBook,
) {
  const isbn13 = isbnOf(book, 'ISBN_13')
  const isbn10 = isbnOf(book, 'ISBN_10')

  const title = book.volumeInfo?.title
  const firstAuthor =
    book.volumeInfo?.authors?.[0]

  return sanity.fetch<{
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
      bookType: BOOK_TYPE,
      googleBooksId: book.id,
      isbn13: isbn13 ?? null,
      isbn10: isbn10 ?? null,
      title: title ?? '',
      firstAuthor: firstAuthor ?? '',
    },
  )
}

// ---------------------------------------------------------
// Sanity document
// ---------------------------------------------------------

function makeBookDocument(book: GoogleBook) {
  const info = book.volumeInfo ?? {}

  const isbn13 = isbnOf(book, 'ISBN_13')
  const isbn10 = isbnOf(book, 'ISBN_10')

  const stableIdentity =
    isbn13 ??
    isbn10 ??
    `google-${book.id}`

  const documentId =
    `book.google.${shortHash(stableIdentity)}`

  const coverUrl = bestImage(book)

  return {
    _id: documentId,
    _type: BOOK_TYPE,
    catalogReviewStatus: 'needsReview',
    catalogSource: 'bookClubImport',

    title: info.title ?? 'Untitled',

    ...(info.subtitle
      ? {subtitle: info.subtitle}
      : {}),

    authors: info.authors ?? [],

    ...(isbn13 ? {isbn13} : {}),
    ...(isbn10 ? {isbn10} : {}),

    googleBooksId: book.id,

    ...(info.description
      ? {description: info.description}
      : {}),

    ...(info.publisher
      ? {publisher: info.publisher}
      : {}),

    ...(info.publishedDate
      ? {publishedDate: info.publishedDate}
      : {}),

    ...(typeof info.pageCount === 'number'
      ? {pageCount: info.pageCount}
      : {}),

    ...(info.categories?.length
      ? {categories: info.categories}
      : {}),

    ...(info.language
      ? {language: info.language}
      : {}),

    ...(typeof info.averageRating === 'number'
      ? {
          googleAverageRating:
            info.averageRating,
        }
      : {}),

    ...(typeof info.ratingsCount === 'number'
      ? {
          googleRatingsCount:
            info.ratingsCount,
        }
      : {}),

    ...(coverUrl
      ? {
          cover: {
            url: coverUrl,
          },
        }
      : {}),

    externalLinks: {
      ...(info.previewLink
        ? {googlePreview: info.previewLink}
        : {}),

      ...(info.infoLink
        ? {googleBooks: info.infoLink}
        : {}),

      ...(info.canonicalVolumeLink
        ? {
            googleCanonical:
              info.canonicalVolumeLink,
          }
        : {}),
    },

    dataSource: {
      provider: 'googleBooks',
      providerId: book.id,
      importedAt: new Date().toISOString(),
    },
  }
}

function makeOfficialPickDocument(
  pick: ReesePick,
  lookup: {title: string; isbn13: string; source: string},
) {
  return {
    _id: `book.google.${shortHash(`isbn:${lookup.isbn13}`)}`,
    _type: BOOK_TYPE,
    catalogReviewStatus: 'needsReview' as const,
    catalogSource: 'bookClubImport' as const,
    title: lookup.title,
    authors: pick.authors,
    isbn13: lookup.isbn13,
    needsCover: true,
    dataSource: {
      provider: 'officialSite',
      providerId: lookup.isbn13,
      importedAt: new Date().toISOString(),
    },
    provenance: {
      provider: 'officialSite',
      sourceId: lookup.isbn13,
      sourceUrl: lookup.source,
      retrievedAt: new Date().toISOString(),
      attribution: "Reese's Book Club official list",
    },
  }
}

// ---------------------------------------------------------
// Import one Reese pick
// ---------------------------------------------------------

async function importPick(
  pick: ReesePick,
): Promise<ImportResult> {
  console.log(
    `\n#${pick.selectionNumber} ${pick.title} — ${
      pick.authors.join(', ') || 'unknown author'
    }`,
  )

  try {
    const books = await searchGoogleBooks(pick)
    const lookup = verifiedLookup(pick)

    if (!books.length && lookup) {
      const existingByIsbn = await sanity.fetch<{_id: string} | null>(
        `*[_type == $bookType && isbn13 == $isbn13][0]{_id}`,
        {bookType: BOOK_TYPE, isbn13: lookup.isbn13},
      )
      if (existingByIsbn) {
        console.log(`  ✓ Existing Everlogue book: ${existingByIsbn._id}`)
        return {
          selectionNumber: pick.selectionNumber,
          title: pick.title,
          requestedAuthors: pick.authors,
          bookId: existingByIsbn._id,
          status: 'existing',
        }
      }
      const document = makeOfficialPickDocument(pick, lookup)
      await sanity.createIfNotExists(document)
      console.log(`  ✓ Created ${document._id} from the official Reese listing (Google had no match)`)
      return {
        selectionNumber: pick.selectionNumber,
        title: pick.title,
        requestedAuthors: pick.authors,
        bookId: document._id,
        status: 'created',
      }
    }

    if (!books.length) {
      console.log('  ✗ No Google Books results')

      return {
        selectionNumber: pick.selectionNumber,
        title: pick.title,
        requestedAuthors: pick.authors,
        status: 'needs-review',
      }
    }

    const ranked = rankCandidates(
      pick,
      books,
    )

    const best = ranked[0]

    if (!best) {
      return {
        selectionNumber: pick.selectionNumber,
        title: pick.title,
        requestedAuthors: pick.authors,
        status: 'needs-review',
      }
    }

    console.log(
      `  Best match: ${best.book.volumeInfo?.title}`,
    )

    console.log(
      `  Authors: ${
        best.book.volumeInfo?.authors?.join(', ') ??
        'unknown'
      }`,
    )

    console.log(`  Score: ${best.score}`)

    if (best.score < MIN_MATCH_SCORE) {
      console.log(
        `  ⚠ Match score below ${MIN_MATCH_SCORE}. Skipping.`,
      )

      return {
        selectionNumber: pick.selectionNumber,
        title: pick.title,
        requestedAuthors: pick.authors,

        matchedTitle:
          best.book.volumeInfo?.title,

        matchedAuthors:
          best.book.volumeInfo?.authors,

        googleBooksId: best.book.id,
        score: best.score,

        status: 'needs-review',

        candidates: ranked
          .slice(0, 5)
          .map((candidate) => ({
            googleBooksId:
              candidate.book.id,

            title:
              candidate.book.volumeInfo?.title,

            authors:
              candidate.book.volumeInfo?.authors,

            score: candidate.score,
          })),
      }
    }

    const existing =
      await findExistingBook(best.book)

    if (existing) {
      console.log(
        `  ✓ Existing Everlogue book: ${existing._id}`,
      )

      return {
        selectionNumber: pick.selectionNumber,
        title: pick.title,
        requestedAuthors: pick.authors,

        matchedTitle:
          best.book.volumeInfo?.title,

        matchedAuthors:
          best.book.volumeInfo?.authors,

        googleBooksId: best.book.id,
        score: best.score,

        bookId: existing._id,
        status: 'existing',
      }
    }

    const document =
      makeBookDocument(best.book)

    /**
     * Never overwrite an existing book because later you may
     * editorially improve it inside Sanity Studio.
     */
    await sanity.createIfNotExists(
      document,
    )

    console.log(
      `  ✓ Created ${document._id}`,
    )

    return {
      selectionNumber: pick.selectionNumber,
      title: pick.title,
      requestedAuthors: pick.authors,

      matchedTitle:
        best.book.volumeInfo?.title,

      matchedAuthors:
        best.book.volumeInfo?.authors,

      googleBooksId: best.book.id,
      score: best.score,

      bookId: document._id,
      status: 'created',
    }
  } catch (error) {
    console.error('  ✗', error)

    return {
      selectionNumber: pick.selectionNumber,
      title: pick.title,
      requestedAuthors: pick.authors,

      status: 'error',

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
    "Everlogue — Reese's Book Club importer",
  )

  console.log(
    '=========================================',
  )

  // -------------------------------------------------------
  // Get official Reese picks
  // -------------------------------------------------------

  const REESE_PICKS =
    await scrapeReesePicks()

  console.log(
    `\nSelections discovered: ${REESE_PICKS.length}`,
  )

  if (!REESE_PICKS.length) {
    throw new Error(
      "No Reese's Book Club picks were discovered.",
    )
  }

  /**
   * As of September 2026, we expect roughly 128 selections.
   *
   * Don't hard-fail on exactly 128 because this script is
   * intentionally future-proof: Reese adds new books.
   *
   * But a suspiciously low number means their HTML probably
   * changed and we should NOT create a broken collection.
   */
  if (REESE_PICKS.length < 120) {
    throw new Error(
      `Only ${REESE_PICKS.length} Reese picks were discovered. ` +
        `Expected at least 120. The Reese website structure may have changed.`,
    )
  }

  // Save exactly what Reese gave us before touching books.
  await writeFile(
    'reese-source-picks.json',
    JSON.stringify(REESE_PICKS, null, 2),
  )

  console.log(
    '✓ Wrote reese-source-picks.json',
  )

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
  const newPicks = REESE_PICKS.filter((pick) => pick.selectionNumber > latestExisting)

  console.log(
    `\nExisting Reese selections: ${existingBooks.length}. Latest #${latestExisting || 0}. New to add: ${newPicks.length}.`,
  )

  if (!existing?._id) {
    throw new Error(
      "Reese's collection is missing. Create it in Studio first so this importer can only append new picks.",
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
    await sleep(700)
  }

  const successful = results.filter(
    (result) =>
      (result.status === 'created' ||
        result.status === 'existing') &&
      result.bookId,
  )

  const needsReview = results.filter(
    (result) =>
      result.status === 'needs-review' ||
      result.status === 'error',
  )

  console.log(
    '\n=========================================',
  )

  console.log('New pick import complete')

  console.log(
    `Resolved: ${successful.length}/${newPicks.length}`,
  )

  console.log(
    `Needs review: ${needsReview.length}`,
  )

  const additions = successful
    .filter((result) => result.bookId && !alreadyOnList.has(result.bookId))
    .sort((a, b) => a.selectionNumber - b.selectionNumber)
    .map((result) => {
      const sourcePick = newPicks.find((pick) => pick.selectionNumber === result.selectionNumber)
      return {
        _key: `reese-${String(result.selectionNumber).padStart(3, '0')}`,
        _type: 'curatedCollectionEntry',
        selectionNumber: result.selectionNumber,
        ...(sourcePick?.selectionDate
          ? {
              selectionDate: sourcePick.selectionDate,
              ...monthYearFromSelectionDate(sourcePick.selectionDate),
            }
          : {}),
        book: {
          _type: 'reference',
          _ref: result.bookId!,
        },
      }
    })

  if (!additions.length) {
    throw new Error(
      `Could not resolve ${newPicks.map((pick) => pick.title).join(', ')}. Existing Reese selections were not changed.`,
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
    `\n✓ Appended ${additions.length} new Reese selection${additions.length === 1 ? '' : 's'} without rewriting the existing list.`,
  )

  // -------------------------------------------------------
  // Review report
  // -------------------------------------------------------

  const report = {
    generatedAt:
      new Date().toISOString(),

    source: REESE_SOURCE_URL,

    requestedSelections:
      REESE_PICKS.length,

    resolvedSelections:
      successful.length,

    needsReview:
      needsReview.length,

    results,
  }

  await writeFile(
    'reese-import-report.json',
    JSON.stringify(report, null, 2),
  )

  console.log(
    '✓ Wrote reese-import-report.json',
  )

  if (needsReview.length) {
    console.log(
      '\nSome titles need manual verification.',
    )

    console.log(
      'Nothing low-confidence was inserted.',
    )

    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
