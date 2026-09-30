/**
 * scripts/import-gma.ts
 *
 * Run:
 *   pnpm tsx scripts/import-gma.ts
 *   Loads .env.local, then .env, from the project root (existing shell env wins).
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

// Change these if your schema uses different type names.
const BOOK_TYPE = 'book'
const COLLECTION_TYPE = 'curatedCollection'

const COLLECTION_ID = 'curatedCollection.gma-book-club'

const GMA_SOURCE_URL =
  'https://www.goodmorningamerica.com/news/story/shop-gma-book-club-picks-list--81520726'

// ---------------------------------------------------------
// Good Morning America Book Club
//
// selectionNumber is chronological across the main GMA club.
// GMA launched in October 2019. There was no February 2020 pick.
// YA Book Club selections are intentionally NOT included here.
// ---------------------------------------------------------

type GmaPick = {
  selectionNumber: number
  year: number
  month: string
  title: string
  authors: string[]
  isbn13?: string
}

const GMA_PICKS: GmaPick[] = [
  {selectionNumber: 1, year: 2019, month: 'October', title: 'Dominicana', authors: ['Angie Cruz']},
  {selectionNumber: 2, year: 2019, month: 'November', title: 'The Family Upstairs', authors: ['Lisa Jewell']},
  {selectionNumber: 3, year: 2019, month: 'December', title: 'Children of Virtue and Vengeance', authors: ['Tomi Adeyemi']},
  {selectionNumber: 4, year: 2020, month: 'January', title: 'Long Bright River', authors: ['Liz Moore']},
  {selectionNumber: 5, year: 2020, month: 'March', title: 'In Five Years', authors: ['Rebecca Serle']},
  {selectionNumber: 6, year: 2020, month: 'April', title: 'Oona Out of Order', authors: ['Margarita Montimore']},
  // Publisher-verified edition: https://us.macmillan.com/books/9781250798442/thebookofv/
  {selectionNumber: 7, year: 2020, month: 'May', title: 'The Book of V.', authors: ['Anna Solomon'], isbn13: '9781250798442'},
  {selectionNumber: 8, year: 2020, month: 'June', title: 'The Vanishing Half', authors: ['Brit Bennett']},
  {selectionNumber: 9, year: 2020, month: 'July', title: 'Sex and Vanity', authors: ['Kevin Kwan']},
  {selectionNumber: 10, year: 2020, month: 'August', title: 'The Lions of Fifth Avenue', authors: ['Fiona Davis']},
  {selectionNumber: 11, year: 2020, month: 'September', title: 'Fifty Words for Rain', authors: ['Asha Lemmie']},
  {selectionNumber: 12, year: 2020, month: 'October', title: 'The Midnight Library', authors: ['Matt Haig']},
  {selectionNumber: 13, year: 2020, month: 'November', title: 'Memorial', authors: ['Bryan Washington']},
  {selectionNumber: 14, year: 2020, month: 'December', title: 'This Time Next Year', authors: ['Sophie Cousens']},
  {selectionNumber: 15, year: 2021, month: 'January', title: 'The Push', authors: ['Ashley Audrain']},
  {selectionNumber: 16, year: 2021, month: 'February', title: 'How the One-Armed Sister Sweeps Her House', authors: ['Cherie Jones']},
  {selectionNumber: 17, year: 2021, month: 'March', title: 'Klara and the Sun', authors: ['Kazuo Ishiguro']},
  {selectionNumber: 18, year: 2021, month: 'April', title: 'Of Women and Salt', authors: ['Gabriela Garcia']},
  {selectionNumber: 19, year: 2021, month: 'May', title: 'Olympus, Texas', authors: ['Stacey Swann']},
  {selectionNumber: 20, year: 2021, month: 'June', title: 'The Other Black Girl', authors: ['Zakiya Dalila Harris']},
  {selectionNumber: 21, year: 2021, month: 'July', title: 'The Personal Librarian', authors: ['Marie Benedict', 'Victoria Christopher Murray']},
  {selectionNumber: 22, year: 2021, month: 'August', title: 'The Husbands', authors: ['Chandler Baker']},
  {selectionNumber: 23, year: 2021, month: 'September', title: 'Several People Are Typing', authors: ['Calvin Kasulke']},
  {selectionNumber: 24, year: 2021, month: 'October', title: 'We Are Not Like Them', authors: ['Christine Pride', 'Jo Piazza']},
  {selectionNumber: 25, year: 2021, month: 'November', title: 'Still Life', authors: ['Sarah Winman']},
  {selectionNumber: 26, year: 2021, month: 'December', title: 'Dava Shastri\'s Last Day', authors: ['Kirthana Ramisetti']},
  {selectionNumber: 27, year: 2022, month: 'January', title: 'The Maid', authors: ['Nita Prose']},
  {selectionNumber: 28, year: 2022, month: 'February', title: 'The Violin Conspiracy', authors: ['Brendan Slocumb']},
  {selectionNumber: 29, year: 2022, month: 'March', title: 'The Love of My Life', authors: ['Rosie Walsh']},
  {selectionNumber: 30, year: 2022, month: 'April', title: 'Lessons in Chemistry', authors: ['Bonnie Garmus']},
  {selectionNumber: 31, year: 2022, month: 'May', title: 'The Change', authors: ['Kirsten Miller']},
  {selectionNumber: 32, year: 2022, month: 'June', title: 'More Than You\'ll Ever Know', authors: ['Katie Gutierrez']},
  {selectionNumber: 33, year: 2022, month: 'July', title: 'The Dead Romantics', authors: ['Ashley Poston']},
  {selectionNumber: 34, year: 2022, month: 'August', title: 'Mika in Real Life', authors: ['Emiko Jean']},
  {selectionNumber: 35, year: 2022, month: 'September', title: 'The Fortunes of Jaded Women', authors: ['Carolyn Huynh']},
  {selectionNumber: 36, year: 2022, month: 'October', title: 'Mad Honey', authors: ['Jodi Picoult', 'Jennifer Finney Boylan']},
  {selectionNumber: 37, year: 2022, month: 'November', title: 'Someday, Maybe', authors: ['Onyi Nwabineli']},
  {selectionNumber: 38, year: 2022, month: 'December', title: 'The Light Pirate', authors: ['Lily Brooks-Dalton']},
  {selectionNumber: 39, year: 2023, month: 'January', title: 'Age of Vice', authors: ['Deepti Kapoor']},
  {selectionNumber: 40, year: 2023, month: 'February', title: 'River Sing Me Home', authors: ['Eleanor Shearer']},
  {selectionNumber: 41, year: 2023, month: 'March', title: 'Pineapple Street', authors: ['Jenny Jackson']},
  {selectionNumber: 42, year: 2023, month: 'April', title: 'Dirty Laundry', authors: ['Disha Bose']},
  {selectionNumber: 43, year: 2023, month: 'May', title: 'The Nigerwife', authors: ['Vanessa Walters']},
  {selectionNumber: 44, year: 2023, month: 'June', title: 'Ink Blood Sister Scribe', authors: ['Emma Törzs']},
  {selectionNumber: 45, year: 2023, month: 'July', title: 'Save What\'s Left', authors: ['Elizabeth Castellano']},
  {selectionNumber: 46, year: 2023, month: 'August', title: 'Family Lore', authors: ['Elizabeth Acevedo']},
  {selectionNumber: 47, year: 2023, month: 'September', title: 'Happiness Falls', authors: ['Angie Kim']},
  {selectionNumber: 48, year: 2023, month: 'October', title: 'The List', authors: ['Yomi Adegoke']},
  {selectionNumber: 49, year: 2023, month: 'November', title: 'Class', authors: ['Stephanie Land']},
  {selectionNumber: 50, year: 2023, month: 'December', title: 'The Frozen River', authors: ['Ariel Lawhon']},
  {selectionNumber: 51, year: 2024, month: 'January', title: 'The Storm We Made', authors: ['Vanessa Chan']},
  {selectionNumber: 52, year: 2024, month: 'February', title: 'Come and Get It', authors: ['Kiley Reid']},
  {selectionNumber: 53, year: 2024, month: 'March', title: 'Listen for the Lie', authors: ['Amy Tintera']},
  {selectionNumber: 54, year: 2024, month: 'April', title: 'Just for the Summer', authors: ['Abby Jimenez']},
  {selectionNumber: 55, year: 2024, month: 'May', title: 'The Ministry of Time', authors: ['Kaliane Bradley']},
  {selectionNumber: 56, year: 2024, month: 'June', title: 'Malas', authors: ['Marcela Fuentes']},
  {selectionNumber: 57, year: 2024, month: 'July', title: 'The Love of My Afterlife', authors: ['Kirsty Greenwood']},
  {selectionNumber: 58, year: 2024, month: 'August', title: 'The Seventh Veil of Salome', authors: ['Silvia Moreno-Garcia']},
  {selectionNumber: 59, year: 2024, month: 'September', title: 'Colored Television', authors: ['Danzy Senna']},
  {selectionNumber: 60, year: 2024, month: 'October', title: 'A Song to Drown Rivers', authors: ['Ann Liang']},
  {selectionNumber: 61, year: 2024, month: 'November', title: 'The Blue Hour', authors: ['Paula Hawkins']},
  {selectionNumber: 62, year: 2024, month: 'December', title: 'The Last One', authors: ['Rachel Howzell Hall']},
  {selectionNumber: 63, year: 2025, month: 'January', title: 'Homeseeking', authors: ['Karissa Chen']},
  {selectionNumber: 64, year: 2025, month: 'February', title: 'Junie', authors: ['Erin Crosby Eckstine']},
  {selectionNumber: 65, year: 2025, month: 'March', title: 'Count My Lies', authors: ['Sophie Stava']},
  {selectionNumber: 66, year: 2025, month: 'April', title: 'The Sirens', authors: ['Emilia Hart']},
  {selectionNumber: 67, year: 2025, month: 'May', title: 'The Original Daughter', authors: ['Jemimah Wei']},
  {selectionNumber: 68, year: 2025, month: 'June', title: 'Atmosphere', authors: ['Taylor Jenkins Reid']},
  {selectionNumber: 69, year: 2025, month: 'July', title: 'The Compound', authors: ['Aisling Rawle']},
  {selectionNumber: 70, year: 2025, month: 'August', title: 'Not Quite Dead Yet', authors: ['Holly Jackson']},
  {selectionNumber: 71, year: 2025, month: 'September', title: 'The Book of Lost Hours', authors: ['Hayley Gelfuso']},
  {selectionNumber: 72, year: 2025, month: 'October', title: 'Twice', authors: ['Mitch Albom']},
  {selectionNumber: 73, year: 2025, month: 'November', title: 'Wreck', authors: ['Catherine Newman']},
  {selectionNumber: 74, year: 2025, month: 'December', title: 'Best Offer Wins', authors: ['Marisa Kashino']},
  {selectionNumber: 75, year: 2026, month: 'January', title: 'Skylark', authors: ['Paula McLain']},
  {selectionNumber: 76, year: 2026, month: 'February', title: 'The Exes', authors: ['Leodora Darlington']},
  {selectionNumber: 77, year: 2026, month: 'March', title: 'The Secret Lives of Murderers\' Wives', authors: ['Elizabeth Arnott']},
  {selectionNumber: 78, year: 2026, month: 'April', title: 'Yesteryear', authors: ['Caro Claire Burke']},
  {selectionNumber: 79, year: 2026, month: 'May', title: 'Homebound', authors: ['Portia Elan']},
  {selectionNumber: 80, year: 2026, month: 'June', title: 'Dolly All the Time', authors: ['Annabel Monaghan']},
  {selectionNumber: 81, year: 2026, month: 'July', title: 'Country People', authors: ['Daniel Mason']},
  {selectionNumber: 82, year: 2026, month: 'August', title: 'Take What You Can', authors: ['Naima Coster']},
  {selectionNumber: 83, year: 2026, month: 'September', title: 'Under Story', authors: ['Chloe Benjamin']},
]

// ---------------------------------------------------------
// Google Books types
// ---------------------------------------------------------

type GoogleIdentifier = {
  type: 'ISBN_10' | 'ISBN_13' | string
  identifier: string
}

type GoogleBook = {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    industryIdentifiers?: GoogleIdentifier[]
    pageCount?: number
    categories?: string[]
    averageRating?: number
    ratingsCount?: number
    language?: string
    imageLinks?: {
      smallThumbnail?: string
      thumbnail?: string
      small?: string
      medium?: string
      large?: string
      extraLarge?: string
    }
    previewLink?: string
    infoLink?: string
    canonicalVolumeLink?: string
  }
}

type GoogleBooksResponse = {
  totalItems?: number
  items?: GoogleBook[]
}

// ---------------------------------------------------------
// Utilities
// ---------------------------------------------------------

function normalize(value = '') {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeTitle(value = '') {
  return normalize(value)
    .replace(/\ba novel\b$/i, '')
    .trim()
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, '-')
}

function shortHash(value: string) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16)
}

function googleImageUrl(url?: string) {
  if (!url) return undefined

  return url
    .replace(/^http:/, 'https:')
    .replace('&edge=curl', '')
    .replace('zoom=1', 'zoom=2')
}

function getIdentifier(
  identifiers: GoogleIdentifier[] | undefined,
  type: 'ISBN_10' | 'ISBN_13',
) {
  return identifiers?.find((identifier) => identifier.type === type)?.identifier
}

function authorMatches(expected: string[], actual: string[] = []) {
  const expectedNormalized = expected.map(normalize)
  const actualNormalized = actual.map(normalize)

  let matches = 0

  for (const expectedAuthor of expectedNormalized) {
    const found = actualNormalized.some(
      (actualAuthor) =>
        actualAuthor === expectedAuthor ||
        actualAuthor.includes(expectedAuthor) ||
        expectedAuthor.includes(actualAuthor),
    )

    if (found) matches++
  }

  return matches
}

// ---------------------------------------------------------
// Candidate scoring
//
// Google Books frequently returns:
// - study guides
// - audiobooks
// - abridged editions
// - unrelated books containing the same title words
//
// We rank candidates rather than blindly taking items[0].
// ---------------------------------------------------------

function scoreGoogleBook(pick: GmaPick, book: GoogleBook) {
  const info = book.volumeInfo ?? {}

  const expectedTitle = normalizeTitle(pick.title)
  const actualTitle = normalizeTitle(info.title)

  let score = 0

  if (actualTitle === expectedTitle) {
    score += 70
  } else if (
    actualTitle.includes(expectedTitle) ||
    expectedTitle.includes(actualTitle)
  ) {
    score += 45
  } else {
    const expectedWords = new Set(expectedTitle.split(' '))
    const actualWords = new Set(actualTitle.split(' '))

    const sharedWords = [...expectedWords].filter((word) =>
      actualWords.has(word),
    )

    const ratio =
      sharedWords.length /
      Math.max(expectedWords.size, actualWords.size, 1)

    score += Math.round(ratio * 35)
  }

  const matchedAuthors = authorMatches(pick.authors, info.authors)

  if (matchedAuthors === pick.authors.length) {
    score += 25
  } else if (matchedAuthors > 0) {
    score += 15
  }

  const isbn13 = getIdentifier(info.industryIdentifiers, 'ISBN_13')
  const isbn10 = getIdentifier(info.industryIdentifiers, 'ISBN_10')

  if (isbn13) score += 5
  else if (isbn10) score += 3

  if (info.description) score += 2
  if (info.pageCount) score += 1
  if (info.imageLinks?.thumbnail) score += 2
  if (info.publisher) score += 1
  if (info.publishedDate) score += 1

  // Penalize obvious companion/study-guide results.
  const suspicious = [
    'summary',
    'study guide',
    'workbook',
    'analysis',
    'companion',
    'review guide',
    'book summary',
  ]

  const normalizedActualTitle = normalize(info.title)

  if (suspicious.some((term) => normalizedActualTitle.includes(term))) {
    score -= 50
  }

  return score
}

// ---------------------------------------------------------
// Google Books lookup
// ---------------------------------------------------------

async function searchGoogleBooks(pick: GmaPick) {
  const author = pick.authors[0]

  const q = pick.isbn13
    ? `isbn:${pick.isbn13}`
    : `intitle:"${pick.title}" inauthor:"${author}"`

  const params = new URLSearchParams({
    q,
    maxResults: '20',
    printType: 'books',
    projection: 'full',
    orderBy: 'relevance',
  })

  if (GOOGLE_BOOKS_API_KEY) {
    params.set('key', GOOGLE_BOOKS_API_KEY)
  }

  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
  )

  if (!response.ok) {
    throw new Error(
      `Google Books HTTP ${response.status}: ${await response.text()}`,
    )
  }

  const data = (await response.json()) as GoogleBooksResponse

  const candidates = (data.items ?? [])
    .map((book) => ({
      book,
      score: scoreGoogleBook(pick, book),
    }))
    .sort((a, b) => b.score - a.score)

  return candidates
}

// ---------------------------------------------------------
// Existing Everlogue book lookup
// ---------------------------------------------------------

async function findExistingBook({
  googleBooksId,
  isbn13,
  isbn10,
  title,
  authors,
}: {
  googleBooksId?: string
  isbn13?: string
  isbn10?: string
  title: string
  authors: string[]
}) {
  const author = authors[0]

  return sanity.fetch<{
    _id: string
    title?: string
  } | null>(
    `*[
      _type == $bookType &&
      (
        defined($googleBooksId) && googleBooksId == $googleBooksId ||
        defined($isbn13) && isbn13 == $isbn13 ||
        defined($isbn10) && isbn10 == $isbn10 ||
        (
          lower(title) == lower($title) &&
          $author in authors
        )
      )
    ][0]{
      _id,
      title
    }`,
    {
      bookType: BOOK_TYPE,
      googleBooksId: googleBooksId ?? null,
      isbn13: isbn13 ?? null,
      isbn10: isbn10 ?? null,
      title,
      author,
    },
  )
}

// ---------------------------------------------------------
// Build Everlogue book document
// ---------------------------------------------------------

function makeBookDocument(book: GoogleBook) {
  const info = book.volumeInfo ?? {}

  const isbn13 = getIdentifier(info.industryIdentifiers, 'ISBN_13')
  const isbn10 = getIdentifier(info.industryIdentifiers, 'ISBN_10')

  const stableIdentity =
    isbn13 ??
    isbn10 ??
    `google-${book.id}`

  const id = `book.google.${shortHash(stableIdentity)}`

  return {
    _id: id,
    _type: BOOK_TYPE,
    catalogReviewStatus: 'needsReview',
    catalogSource: 'bookClubImport',

    title: info.title ?? 'Untitled',
    subtitle: info.subtitle ?? null,

    // Adjust this if your schema uses author references instead.
    authors: info.authors ?? [],

    slug: {
      _type: 'slug',
      current: `${slugify(info.title ?? 'book')}-${shortHash(stableIdentity).slice(0, 6)}`,
    },

    description: info.description ?? null,

    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    pageCount: info.pageCount ?? null,

    categories: info.categories ?? [],

    isbn10: isbn10 ?? null,
    isbn13: isbn13 ?? null,

    language: info.language ?? null,

    externalRatings: {
      googleBooks: {
        averageRating: info.averageRating ?? null,
        ratingsCount: info.ratingsCount ?? null,
      },
    },

    cover: {
      source: 'googleBooks',
      url: googleImageUrl(
        info.imageLinks?.extraLarge ??
          info.imageLinks?.large ??
          info.imageLinks?.medium ??
          info.imageLinks?.thumbnail,
      ),
    },

    googleBooksId: book.id,

    externalLinks: {
      googleBooks:
        info.canonicalVolumeLink ??
        info.infoLink ??
        info.previewLink ??
        null,
    },

    metadataSource: 'googleBooks',

    metadataImportedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------
// Match + import a single selection
// ---------------------------------------------------------

type ImportResult = {
  selectionNumber: number
  year: number
  month: string
  title: string
  requestedAuthors: string[]
  bookId?: string
  googleBooksId?: string
  matchedTitle?: string
  matchedAuthors?: string[]
  score?: number
  status: 'created' | 'existing' | 'needs-review' | 'error'
  candidates?: {
    googleBooksId: string
    title?: string
    authors?: string[]
    score: number
  }[]
  error?: string
}

async function importPick(pick: GmaPick): Promise<ImportResult> {
  console.log(
    `\n[${pick.selectionNumber}/83] ${pick.month} ${pick.year}: ${pick.title} — ${pick.authors.join(', ')}`,
  )

  try {
    const candidates = await searchGoogleBooks(pick)
    const best = candidates[0]

    if (!best) {
      console.warn('  ⚠ No Google Books results')

      return {
        selectionNumber: pick.selectionNumber,
        year: pick.year,
        month: pick.month,
        title: pick.title,
        requestedAuthors: pick.authors,
        status: 'needs-review',
      }
    }

    console.log(
      `  Google: ${best.book.volumeInfo?.title} — ${
        best.book.volumeInfo?.authors?.join(', ') ?? 'Unknown'
      }`,
    )

    console.log(`  Match score: ${best.score}`)

    // 80+ should generally be title + author + metadata.
    // Anything lower deserves review instead of silently polluting catalog.
    if (best.score < 80) {
      console.warn('  ⚠ Low-confidence match; skipped')

      return {
        selectionNumber: pick.selectionNumber,
        year: pick.year,
        month: pick.month,
        title: pick.title,
        requestedAuthors: pick.authors,
        matchedTitle: best.book.volumeInfo?.title,
        matchedAuthors: best.book.volumeInfo?.authors,
        googleBooksId: best.book.id,
        score: best.score,
        status: 'needs-review',
        candidates: candidates.slice(0, 5).map(({book, score}) => ({
          googleBooksId: book.id,
          title: book.volumeInfo?.title,
          authors: book.volumeInfo?.authors,
          score,
        })),
      }
    }

    const info = best.book.volumeInfo ?? {}

    const isbn13 = getIdentifier(info.industryIdentifiers, 'ISBN_13')
    const isbn10 = getIdentifier(info.industryIdentifiers, 'ISBN_10')

    // Search Everlogue before creating anything.
    const existing = await findExistingBook({
      googleBooksId: best.book.id,
      isbn13,
      isbn10,
      title: pick.title,
      authors: pick.authors,
    })

    if (existing) {
      console.log(`  ✓ Existing Everlogue book: ${existing._id}`)

      return {
        selectionNumber: pick.selectionNumber,
        year: pick.year,
        month: pick.month,
        title: pick.title,
        requestedAuthors: pick.authors,
        matchedTitle: best.book.volumeInfo?.title,
        matchedAuthors: best.book.volumeInfo?.authors,
        googleBooksId: best.book.id,
        score: best.score,
        bookId: existing._id,
        status: 'existing',
      }
    }

    const document = makeBookDocument(best.book)

    // createIfNotExists lets you safely rerun this script later
    // without overwriting editorial changes in Studio.
    await sanity.createIfNotExists(document)

    console.log(`  ✓ Created ${document._id}`)

    return {
      selectionNumber: pick.selectionNumber,
      year: pick.year,
      month: pick.month,
      title: pick.title,
      requestedAuthors: pick.authors,
      matchedTitle: best.book.volumeInfo?.title,
      matchedAuthors: best.book.volumeInfo?.authors,
      googleBooksId: best.book.id,
      score: best.score,
      bookId: document._id,
      status: 'created',
    }
  } catch (error) {
    console.error('  ✗', error)

    return {
      selectionNumber: pick.selectionNumber,
      year: pick.year,
      month: pick.month,
      title: pick.title,
      requestedAuthors: pick.authors,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ---------------------------------------------------------
// Import
// ---------------------------------------------------------

async function main() {
  console.log('Everlogue — GMA Book Club importer')
  console.log('====================================')
  console.log(`Selections: ${GMA_PICKS.length}`)

  if (GMA_PICKS.length !== 83) {
    throw new Error(
      `Expected 83 GMA selections; found ${GMA_PICKS.length}`,
    )
  }

  const results: ImportResult[] = []

  // Deliberately sequential.
  //
  // It's easier on Google Books quota and makes logs readable.
  for (const pick of GMA_PICKS) {
    const result = await importPick(pick)

    results.push(result)

    // Small pause so we aren't hammering Google Books.
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  const successful = results.filter(
    (result) =>
      (result.status === 'created' || result.status === 'existing') &&
      result.bookId,
  )

  const needsReview = results.filter(
    (result) =>
      result.status === 'needs-review' ||
      result.status === 'error',
  )

  console.log('\n====================================')
  console.log('Book import complete')
  console.log(`Resolved: ${successful.length}`)
  console.log(`Needs review: ${needsReview.length}`)

  // -------------------------------------------------------
  // Create collection entries
  //
  // Entries stay in chronological GMA selection order.
  // February 2020 is absent because GMA did not name a main-club pick that month.
  // -------------------------------------------------------

  const collectionEntries = results
    .filter((result) => result.bookId)
    .sort((a, b) => a.selectionNumber - b.selectionNumber)
    .map((result) => ({
      _key: `gma-${String(result.selectionNumber).padStart(3, '0')}`,
      _type: 'curatedCollectionEntry',

      selectionNumber: result.selectionNumber,
      month: result.month,
      year: result.year,

      book: {
        _type: 'reference',
        _ref: result.bookId!,
      },
    }))

  const collection = {
    _id: COLLECTION_ID,
    _type: COLLECTION_TYPE,

    title: 'GMA Book Club',

    slug: {
      _type: 'slug',
      current: 'gma-book-club',
    },

    collectionType: 'celebrityBookClub',

    curator: {
      name: 'Good Morning America',
    },

    description:
      'Explore Good Morning America Book Club selections from the club\'s October 2019 launch through the latest pick.',

    source: {
      name: 'GMA Book Club',
      url: GMA_SOURCE_URL,
    },

    totalSelections: 83,

    books: collectionEntries,

    lastSyncedAt: new Date().toISOString(),
  }

  // For the COLLECTION, createOrReplace is intentional:
  // its membership/order is controlled by the external list.
  //
  // Individual BOOKS use createIfNotExists so your editorial
  // edits aren't overwritten.
  await sanity.createOrReplace(collection)

  console.log(
    `\n✓ Collection saved with ${collectionEntries.length}/83 resolved selections`,
  )

  // -------------------------------------------------------
  // Create review report
  // -------------------------------------------------------

  const report = {
    generatedAt: new Date().toISOString(),
    requestedSelections: GMA_PICKS.length,
    resolvedSelections: successful.length,
    needsReview: needsReview.length,
    results,
  }

  await writeFile(
    'gma-import-report.json',
    JSON.stringify(report, null, 2),
  )

  console.log('✓ Wrote gma-import-report.json')

  if (needsReview.length) {
    console.log(
      '\nSome titles need manual verification. Nothing low-confidence was inserted.',
    )

    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
