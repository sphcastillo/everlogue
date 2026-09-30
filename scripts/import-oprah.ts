/**
 * scripts/import-oprah.ts
 *
 * Run:
 *   pnpm tsx scripts/import-oprah.ts
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
import {monthName, OPRAH_SELECTION_DATES} from '../src/lib/club-selection-dates'

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

const COLLECTION_ID = 'curatedCollection.oprahs-book-club'

const OPRAH_SOURCE_URL =
  'https://www.oprahdaily.com/entertainment/books/g23067476/oprah-book-club-list/'

// ---------------------------------------------------------
// Oprah's Book Club
//
// selectionNumber is intentionally separate from the book.
//
// A New Earth occurs twice: #65 and #110.
// Those entries should reference the SAME Everlogue book.
// ---------------------------------------------------------

type OprahPick = {
  selectionNumber: number
  title: string
  authors: string[]
}

const OPRAH_PICKS: OprahPick[] = [
  {selectionNumber: 1, title: 'The Deep End of the Ocean', authors: ['Jacquelyn Mitchard']},
  {selectionNumber: 2, title: 'Song of Solomon', authors: ['Toni Morrison']},
  {selectionNumber: 3, title: 'The Book of Ruth', authors: ['Jane Hamilton']},
  {selectionNumber: 4, title: "She's Come Undone", authors: ['Wally Lamb']},
  {selectionNumber: 5, title: 'Stones from the River', authors: ['Ursula Hegi']},
  {selectionNumber: 6, title: 'The Rapture of Canaan', authors: ['Sheri Reynolds']},
  {selectionNumber: 7, title: 'Songs in Ordinary Time', authors: ['Mary McGarry Morris']},
  {selectionNumber: 8, title: 'The Heart of a Woman', authors: ['Maya Angelou']},
  {selectionNumber: 9, title: 'A Lesson Before Dying', authors: ['Ernest J. Gaines']},
  {selectionNumber: 10, title: 'Ellen Foster', authors: ['Kaye Gibbons']},
  {selectionNumber: 11, title: 'A Virtuous Woman', authors: ['Kaye Gibbons']},
  {selectionNumber: 12, title: 'The Meanest Thing to Say', authors: ['Bill Cosby']},
  {selectionNumber: 13, title: 'The Treasure Hunt', authors: ['Bill Cosby']},
  {selectionNumber: 14, title: 'The Best Way to Play', authors: ['Bill Cosby']},
  {selectionNumber: 15, title: 'Paradise', authors: ['Toni Morrison']},
  {selectionNumber: 16, title: 'Here on Earth', authors: ['Alice Hoffman']},
  {selectionNumber: 17, title: 'Black and Blue', authors: ['Anna Quindlen']},
  {selectionNumber: 18, title: 'Breath, Eyes, Memory', authors: ['Edwidge Danticat']},
  {selectionNumber: 19, title: 'I Know This Much Is True', authors: ['Wally Lamb']},
  {
    selectionNumber: 20,
    title: 'What Looks Like Crazy on an Ordinary Day',
    authors: ['Pearl Cleage'],
  },
  {selectionNumber: 21, title: 'Midwives', authors: ['Chris Bohjalian']},
  {selectionNumber: 22, title: 'Where the Heart Is', authors: ['Billie Letts']},
  {selectionNumber: 23, title: 'Jewel', authors: ['Bret Lott']},
  {selectionNumber: 24, title: 'The Reader', authors: ['Bernhard Schlink']},
  {selectionNumber: 25, title: "The Pilot's Wife", authors: ['Anita Shreve']},
  {selectionNumber: 26, title: 'White Oleander', authors: ['Janet Fitch']},
  {selectionNumber: 27, title: 'Mother of Pearl', authors: ['Melinda Haynes']},
  {selectionNumber: 28, title: 'Tara Road', authors: ['Maeve Binchy']},
  {selectionNumber: 29, title: 'River, Cross My Heart', authors: ['Breena Clarke']},
  {selectionNumber: 30, title: 'Vinegar Hill', authors: ['A. Manette Ansay']},
  {selectionNumber: 31, title: 'A Map of the World', authors: ['Jane Hamilton']},
  {selectionNumber: 32, title: 'Gap Creek', authors: ['Robert Morgan']},
  {selectionNumber: 33, title: 'Daughter of Fortune', authors: ['Isabel Allende']},
  {selectionNumber: 34, title: 'Back Roads', authors: ["Tawni O'Dell"]},
  {selectionNumber: 35, title: 'The Bluest Eye', authors: ['Toni Morrison']},
  {selectionNumber: 36, title: 'While I Was Gone', authors: ['Sue Miller']},
  {selectionNumber: 37, title: 'The Poisonwood Bible', authors: ['Barbara Kingsolver']},
  {selectionNumber: 38, title: 'Open House', authors: ['Elizabeth Berg']},
  {selectionNumber: 39, title: 'Drowning Ruth', authors: ['Christina Schwarz']},
  {selectionNumber: 40, title: 'House of Sand and Fog', authors: ['Andre Dubus III']},
  {selectionNumber: 41, title: 'We Were the Mulvaneys', authors: ['Joyce Carol Oates']},
  {selectionNumber: 42, title: 'Icy Sparks', authors: ['Gwyn Hyman Rubio']},
  {
    selectionNumber: 43,
    title: 'Stolen Lives',
    authors: ['Malika Oufkir', 'Michèle Fitoussi'],
  },
  {selectionNumber: 44, title: 'Cane River', authors: ['Lalita Tademy']},
  {selectionNumber: 45, title: 'The Corrections', authors: ['Jonathan Franzen']},
  {selectionNumber: 46, title: 'A Fine Balance', authors: ['Rohinton Mistry']},
  {selectionNumber: 47, title: 'Fall on Your Knees', authors: ['Ann-Marie MacDonald']},
  {selectionNumber: 48, title: 'Sula', authors: ['Toni Morrison']},
  {selectionNumber: 49, title: 'East of Eden', authors: ['John Steinbeck']},
  {selectionNumber: 50, title: 'Cry, the Beloved Country', authors: ['Alan Paton']},
  {
    selectionNumber: 51,
    title: 'One Hundred Years of Solitude',
    authors: ['Gabriel García Márquez'],
  },
  {
    selectionNumber: 52,
    title: 'The Heart Is a Lonely Hunter',
    authors: ['Carson McCullers'],
  },
  {selectionNumber: 53, title: 'Anna Karenina', authors: ['Leo Tolstoy']},
  {selectionNumber: 54, title: 'The Good Earth', authors: ['Pearl S. Buck']},
  {selectionNumber: 55, title: 'As I Lay Dying', authors: ['William Faulkner']},
  {selectionNumber: 56, title: 'The Sound and the Fury', authors: ['William Faulkner']},
  {selectionNumber: 57, title: 'Light in August', authors: ['William Faulkner']},
  {selectionNumber: 58, title: 'A Million Little Pieces', authors: ['James Frey']},
  {selectionNumber: 59, title: 'Night', authors: ['Elie Wiesel']},
  {selectionNumber: 60, title: 'The Measure of a Man', authors: ['Sidney Poitier']},
  {selectionNumber: 61, title: 'The Road', authors: ['Cormac McCarthy']},
  {selectionNumber: 62, title: 'Middlesex', authors: ['Jeffrey Eugenides']},
  {
    selectionNumber: 63,
    title: 'Love in the Time of Cholera',
    authors: ['Gabriel García Márquez'],
  },
  {selectionNumber: 64, title: 'The Pillars of the Earth', authors: ['Ken Follett']},
  {selectionNumber: 65, title: 'A New Earth', authors: ['Eckhart Tolle']},
  {
    selectionNumber: 66,
    title: 'The Story of Edgar Sawtelle',
    authors: ['David Wroblewski'],
  },
  {selectionNumber: 67, title: "Say You're One of Them", authors: ['Uwem Akpan']},
  {selectionNumber: 68, title: 'Freedom', authors: ['Jonathan Franzen']},
  {selectionNumber: 69, title: 'Great Expectations', authors: ['Charles Dickens']},
  {selectionNumber: 70, title: 'A Tale of Two Cities', authors: ['Charles Dickens']},
  {selectionNumber: 71, title: 'Wild', authors: ['Cheryl Strayed']},
  {
    selectionNumber: 72,
    title: 'The Twelve Tribes of Hattie',
    authors: ['Ayana Mathis'],
  },
  {selectionNumber: 73, title: 'The Invention of Wings', authors: ['Sue Monk Kidd']},
  {selectionNumber: 74, title: 'Ruby', authors: ['Cynthia Bond']},
  {
    selectionNumber: 75,
    title: 'The Underground Railroad',
    authors: ['Colson Whitehead'],
  },
  {selectionNumber: 76, title: 'Love Warrior', authors: ['Glennon Doyle']},
  {selectionNumber: 77, title: 'Behold the Dreamers', authors: ['Imbolo Mbue']},
  {selectionNumber: 78, title: 'An American Marriage', authors: ['Tayari Jones']},
  {selectionNumber: 79, title: 'The Sun Does Shine', authors: ['Anthony Ray Hinton']},
  {selectionNumber: 80, title: 'Becoming', authors: ['Michelle Obama']},
  {selectionNumber: 81, title: 'The Water Dancer', authors: ['Ta-Nehisi Coates']},
  {selectionNumber: 82, title: 'Olive, Again', authors: ['Elizabeth Strout']},
  {selectionNumber: 83, title: 'American Dirt', authors: ['Jeanine Cummins']},
  {
    selectionNumber: 84,
    title: 'Hidden Valley Road: Inside the Mind of an American Family',
    authors: ['Robert Kolker'],
  },
  {selectionNumber: 85, title: 'Deacon King Kong', authors: ['James McBride']},
  {
    selectionNumber: 86,
    title: 'Caste: The Origins of Our Discontents',
    authors: ['Isabel Wilkerson'],
  },
  {selectionNumber: 87, title: 'Jack', authors: ['Marilynne Robinson']},
  {selectionNumber: 88, title: 'Lila', authors: ['Marilynne Robinson']},
  {selectionNumber: 89, title: 'Home', authors: ['Marilynne Robinson']},
  {selectionNumber: 90, title: 'Gilead', authors: ['Marilynne Robinson']},
  {selectionNumber: 91, title: 'The Sweetness of Water', authors: ['Nathan Harris']},
  {
    selectionNumber: 92,
    title: 'The Love Songs of W.E.B. Du Bois',
    authors: ['Honorée Fanonne Jeffers'],
  },
  {selectionNumber: 93, title: 'Bewilderment', authors: ['Richard Powers']},
  {selectionNumber: 94, title: 'The Way of Integrity', authors: ['Martha Beck']},
  {selectionNumber: 95, title: 'Finding Me', authors: ['Viola Davis']},
  {selectionNumber: 96, title: 'Nightcrawling', authors: ['Leila Mottley']},
  {
    selectionNumber: 97,
    title: 'That Bird Has My Wings',
    authors: ['Jarvis Jay Masters'],
  },
  {selectionNumber: 98, title: 'Demon Copperhead', authors: ['Barbara Kingsolver']},
  {selectionNumber: 99, title: 'Bittersweet', authors: ['Susan Cain']},
  {selectionNumber: 100, title: 'Hello Beautiful', authors: ['Ann Napolitano']},
  {
    selectionNumber: 101,
    title: 'The Covenant of Water',
    authors: ['Abraham Verghese'],
  },
  {selectionNumber: 102, title: 'Wellness', authors: ['Nathan Hill']},
  {selectionNumber: 103, title: 'Let Us Descend', authors: ['Jesmyn Ward']},
  {
    selectionNumber: 104,
    title: 'The Many Lives of Mama Love',
    authors: ['Lara Love Hardin'],
  },
  {selectionNumber: 105, title: 'Long Island', authors: ['Colm Tóibín']},
  {selectionNumber: 106, title: 'Familiaris', authors: ['David Wroblewski']},
  {selectionNumber: 107, title: 'Tell Me Everything', authors: ['Elizabeth Strout']},
  {
    selectionNumber: 108,
    title: 'From Here to the Great Unknown',
    authors: ['Lisa Marie Presley', 'Riley Keough'],
  },
  {
    selectionNumber: 109,
    title: 'Small Things Like These',
    authors: ['Claire Keegan'],
  },

  // A New Earth was selected again.
  {selectionNumber: 110, title: 'A New Earth', authors: ['Eckhart Tolle']},

  {selectionNumber: 111, title: 'Dream State', authors: ['Eric Puchner']},
  {selectionNumber: 112, title: 'The Tell', authors: ['Amy Griffin']},
  {selectionNumber: 113, title: 'Matriarch', authors: ['Tina Knowles']},
  {
    selectionNumber: 114,
    title: 'The Emperor of Gladness',
    authors: ['Ocean Vuong'],
  },
  {selectionNumber: 115, title: 'The River Is Waiting', authors: ['Wally Lamb']},
  {selectionNumber: 116, title: 'Culpability', authors: ['Bruce Holsinger']},
  {selectionNumber: 117, title: 'Bridge of Sighs', authors: ['Richard Russo']},
  {
    selectionNumber: 118,
    title: 'All the Way to the River',
    authors: ['Elizabeth Gilbert'],
  },
  {
    selectionNumber: 119,
    title: 'A Guardian and a Thief',
    authors: ['Megha Majumdar'],
  },
  {selectionNumber: 120, title: 'Some Bright Nowhere', authors: ['Ann Packer']},
  {selectionNumber: 121, title: 'Kin', authors: ['Tayari Jones']},
  {selectionNumber: 122, title: 'Go Gentle', authors: ['Maria Semple']},
  {selectionNumber: 123, title: 'John of John', authors: ['Douglas Stuart']},
  {selectionNumber: 124, title: 'Little Wonder', authors: ['Sophie Chen Keller']},
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

function scoreGoogleBook(pick: OprahPick, book: GoogleBook) {
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

async function searchGoogleBooks(pick: OprahPick) {
  const author = pick.authors[0]

  const q = `intitle:"${pick.title}" inauthor:"${author}"`

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

async function importPick(pick: OprahPick): Promise<ImportResult> {
  console.log(
    `\n[${pick.selectionNumber}/124] ${pick.title} — ${pick.authors.join(', ')}`,
  )

  try {
    const candidates = await searchGoogleBooks(pick)
    const best = candidates[0]

    if (!best) {
      console.warn('  ⚠ No Google Books results')

      return {
        selectionNumber: pick.selectionNumber,
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
  console.log('Everlogue — Oprah Book Club importer')
  console.log('====================================')
  console.log(`Selections: ${OPRAH_PICKS.length}`)

  if (OPRAH_PICKS.length !== 124) {
    throw new Error(
      `Expected 124 Oprah selections; found ${OPRAH_PICKS.length}`,
    )
  }

  const results: ImportResult[] = []

  // Deliberately sequential.
  //
  // It's easier on Google Books quota and makes logs readable.
  for (const pick of OPRAH_PICKS) {
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
  // Important:
  // The collection has 124 entries even though A New Earth
  // points to the same book twice.
  // -------------------------------------------------------

  const collectionEntries = results
    .filter((result) => result.bookId)
    .sort((a, b) => a.selectionNumber - b.selectionNumber)
    .map((result) => {
      const selected = OPRAH_SELECTION_DATES[result.selectionNumber]
      return {
        _key: `oprah-${String(result.selectionNumber).padStart(3, '0')}`,
        _type: 'curatedCollectionEntry',

        selectionNumber: result.selectionNumber,
        ...(selected
          ? {
              month: monthName(selected.month),
              year: selected.year,
            }
          : {}),

        book: {
          _type: 'reference',
          _ref: result.bookId!,
        },
      }
    })

  const collection = {
    _id: COLLECTION_ID,
    _type: COLLECTION_TYPE,

    title: "Oprah's Book Club",

    slug: {
      _type: 'slug',
      current: 'oprahs-book-club',
    },

    collectionType: 'celebrityBookClub',

    curator: {
      name: 'Oprah Winfrey',
    },

    description:
      "Explore Oprah's Book Club selections from the beginning of the club to the latest pick.",

    source: {
      name: "Oprah's Book Club",
      url: OPRAH_SOURCE_URL,
    },

    totalSelections: 124,

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
    `\n✓ Collection saved with ${collectionEntries.length}/124 resolved selections`,
  )

  // -------------------------------------------------------
  // Create review report
  // -------------------------------------------------------

  const report = {
    generatedAt: new Date().toISOString(),
    requestedSelections: OPRAH_PICKS.length,
    resolvedSelections: successful.length,
    needsReview: needsReview.length,
    results,
  }

  await writeFile(
    'oprah-import-report.json',
    JSON.stringify(report, null, 2),
  )

  console.log('✓ Wrote oprah-import-report.json')

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
