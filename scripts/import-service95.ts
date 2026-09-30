/**
 * scripts/import-service95.ts
 *
 * Run:
 *   pnpm tsx scripts/import-service95.ts
 *   Loads .env.local, then .env, from the project root (existing shell env wins).
 *
 * Required env:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_WRITE_TOKEN
 *
 * Optional:
 *   GOOGLE_BOOKS_API_KEY
 *
 * Only Service95 monthly reads are included. Gift lists and other Service95
 * reading lists are excluded. Months with no monthly read are omitted
 * (December 2023, August 2024, December 2024).
 */

import {config} from 'dotenv'
import {createClient} from '@sanity/client'
import {createHash} from 'node:crypto'
import {writeFile} from 'node:fs/promises'

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
const COLLECTION_ID = 'curatedCollection.service95-book-club'
const SOURCE_URL = 'https://www.service95.com/book-club'

type Service95Pick = {
  selectionNumber: number
  year: number
  month: string
  title: string
  authors: string[]
  sourceUrl?: string
}

const SERVICE95_PICKS: Service95Pick[] = [
  {selectionNumber: 1, year: 2023, month: 'June', title: 'Shuggie Bain', authors: ['Douglas Stuart'], sourceUrl: 'https://www.service95.com/books/shuggie-bain-3'},
  {selectionNumber: 2, year: 2023, month: 'July', title: 'Pachinko', authors: ['Min Jin Lee']},
  {selectionNumber: 3, year: 2023, month: 'August', title: 'Half of a Yellow Sun', authors: ['Chimamanda Ngozi Adichie']},
  {selectionNumber: 4, year: 2023, month: 'September', title: 'Just Kids', authors: ['Patti Smith']},
  {selectionNumber: 5, year: 2023, month: 'October', title: 'One Hundred Years of Solitude', authors: ['Gabriel García Márquez']},
  {selectionNumber: 6, year: 2023, month: 'November', title: 'The Vanishing Half', authors: ['Brit Bennett']},
  {selectionNumber: 7, year: 2024, month: 'January', title: 'The Guest', authors: ['Emma Cline']},
  {selectionNumber: 8, year: 2024, month: 'February', title: 'A Thousand Splendid Suns', authors: ['Khaled Hosseini']},
  {selectionNumber: 9, year: 2024, month: 'March', title: 'Trust', authors: ['Hernan Diaz']},
  {selectionNumber: 10, year: 2024, month: 'April', title: 'Crying in H Mart', authors: ['Michelle Zauner']},
  {selectionNumber: 11, year: 2024, month: 'May', title: 'Swimming in the Dark', authors: ['Tomasz Jedrowski']},
  {selectionNumber: 12, year: 2024, month: 'June', title: 'Say Nothing', authors: ['Patrick Radden Keefe']},
  {selectionNumber: 13, year: 2024, month: 'July', title: 'Noughts & Crosses', authors: ['Malorie Blackman']},
  {selectionNumber: 14, year: 2024, month: 'September', title: 'Bad Habit', authors: ['Alana S. Portero']},
  {selectionNumber: 15, year: 2024, month: 'October', title: 'Lincoln in the Bardo', authors: ['George Saunders']},
  {selectionNumber: 16, year: 2024, month: 'November', title: "On Earth We're Briefly Gorgeous", authors: ['Ocean Vuong']},
  {selectionNumber: 17, year: 2025, month: 'January', title: 'Drive Your Plow Over the Bones of the Dead', authors: ['Olga Tokarczuk']},
  {selectionNumber: 18, year: 2025, month: 'February', title: 'The Bee Sting', authors: ['Paul Murray']},
  {selectionNumber: 19, year: 2025, month: 'March', title: 'There There', authors: ['Tommy Orange']},
  {selectionNumber: 20, year: 2025, month: 'April', title: 'Grief Is the Thing with Feathers', authors: ['Max Porter']},
  {selectionNumber: 21, year: 2025, month: 'May', title: 'Still Born', authors: ['Guadalupe Nettel']},
  {selectionNumber: 22, year: 2025, month: 'June', title: 'Widow Basquiat', authors: ['Jennifer Clement']},
  {selectionNumber: 23, year: 2025, month: 'July', title: 'Small Boat', authors: ['Vincent Delecroix'], sourceUrl: 'https://www.service95.com/books/small-boat-vincent-delecroix'},
  {selectionNumber: 24, year: 2025, month: 'August', title: 'This House of Grief', authors: ['Helen Garner'], sourceUrl: 'https://www.service95.com/books/this-house-of-grief-helen-garner'},
  {selectionNumber: 25, year: 2025, month: 'September', title: 'The Trees', authors: ['Percival Everett'], sourceUrl: 'https://www.service95.com/books/the-trees-percival-everett'},
  {selectionNumber: 26, year: 2025, month: 'October', title: 'Flesh', authors: ['David Szalay'], sourceUrl: 'https://www.service95.com/books/flesh-david-szalay'},
  {selectionNumber: 27, year: 2025, month: 'November', title: "The Handmaid's Tale", authors: ['Margaret Atwood'], sourceUrl: 'https://www.service95.com/books/the-handmaids-tale-margaret-atwood'},
  {selectionNumber: 28, year: 2025, month: 'December', title: 'Brightly Shining', authors: ['Ingvild Rishøi'], sourceUrl: 'https://www.service95.com/books/brightly-shining-ingvild-rishoi'},
  {selectionNumber: 29, year: 2026, month: 'January', title: 'Night People', authors: ['Mark Ronson'], sourceUrl: 'https://www.service95.com/books/night-people-mark-ronson'},
  {selectionNumber: 30, year: 2026, month: 'February', title: 'The Son of Man', authors: ['Jean-Baptiste Del Amo'], sourceUrl: 'https://www.service95.com/books/the-son-of-man-jean-baptiste-del-amo'},
  {selectionNumber: 31, year: 2026, month: 'March', title: 'Bad Feminist', authors: ['Roxane Gay'], sourceUrl: 'https://www.service95.com/books/bad-feminist-2'},
  {selectionNumber: 32, year: 2026, month: 'April', title: 'Jerusalem', authors: ['Jez Butterworth'], sourceUrl: 'https://www.service95.com/books/jerusalem-2'},
  {selectionNumber: 33, year: 2026, month: 'May', title: 'So Late in the Day', authors: ['Claire Keegan'], sourceUrl: 'https://www.service95.com/books/so-late-in-the-day'},
  {selectionNumber: 34, year: 2026, month: 'June', title: 'Having Spent Life Seeking', authors: ['Kae Tempest'], sourceUrl: 'https://www.service95.com/books/having-spent-life-seeking-kae-tempest'},
  {selectionNumber: 35, year: 2026, month: 'July', title: 'Free', authors: ['Lea Ypi'], sourceUrl: 'https://www.service95.com/books/free-lea-ypi'},
  {selectionNumber: 36, year: 2026, month: 'August', title: 'Lost Lambs', authors: ['Madeline Cash'], sourceUrl: 'https://www.service95.com/books/lost-lambs-madeline-cash'},
  {selectionNumber: 37, year: 2026, month: 'September', title: 'Martyr!', authors: ['Kaveh Akbar'], sourceUrl: 'https://www.service95.com/books/martyr'},
]

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
  items?: GoogleBook[]
}

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
  return normalize(value).replace(/\ba novel\b$/i, '').trim()
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, '-')
}

function shortHash(value: string) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16)
}

function googleImageUrl(url?: string) {
  if (!url) return undefined
  return url.replace(/^http:/, 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2')
}

function getIdentifier(identifiers: GoogleIdentifier[] | undefined, type: 'ISBN_10' | 'ISBN_13') {
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

function scoreGoogleBook(pick: Service95Pick, book: GoogleBook) {
  const info = book.volumeInfo ?? {}
  const expectedTitle = normalizeTitle(pick.title)
  const actualTitle = normalizeTitle(info.title)
  let score = 0

  if (actualTitle === expectedTitle) score += 70
  else if (actualTitle.includes(expectedTitle) || expectedTitle.includes(actualTitle)) score += 45
  else {
    const expectedWords = new Set(expectedTitle.split(' '))
    const actualWords = new Set(actualTitle.split(' '))
    const sharedWords = [...expectedWords].filter((word) => actualWords.has(word))
    score += Math.round(sharedWords.length / Math.max(expectedWords.size, actualWords.size, 1) * 35)
  }

  const matchedAuthors = authorMatches(pick.authors, info.authors)
  if (matchedAuthors === pick.authors.length) score += 25
  else if (matchedAuthors > 0) score += 15

  const isbn13 = getIdentifier(info.industryIdentifiers, 'ISBN_13')
  const isbn10 = getIdentifier(info.industryIdentifiers, 'ISBN_10')
  if (isbn13) score += 5
  else if (isbn10) score += 3
  if (info.description) score += 2
  if (info.pageCount) score += 1
  if (info.imageLinks?.thumbnail) score += 2
  if (info.publisher) score += 1
  if (info.publishedDate) score += 1

  const suspicious = ['summary', 'study guide', 'workbook', 'analysis', 'companion', 'review guide', 'book summary']
  if (suspicious.some((term) => normalize(info.title).includes(term))) score -= 50

  return score
}

async function searchGoogleBooks(pick: Service95Pick) {
  const params = new URLSearchParams({
    q: `intitle:"${pick.title}" inauthor:"${pick.authors[0]}"`,
    maxResults: '20',
    printType: 'books',
    projection: 'full',
    orderBy: 'relevance',
  })
  if (GOOGLE_BOOKS_API_KEY) params.set('key', GOOGLE_BOOKS_API_KEY)

  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Google Books HTTP ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as GoogleBooksResponse
  return (data.items ?? [])
    .map((book) => ({book, score: scoreGoogleBook(pick, book)}))
    .sort((a, b) => b.score - a.score)
}

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
  return sanity.fetch<{_id: string; title?: string} | null>(
    `*[
      _type == $bookType &&
      (
        defined($googleBooksId) && googleBooksId == $googleBooksId ||
        defined($isbn13) && isbn13 == $isbn13 ||
        defined($isbn10) && isbn10 == $isbn10 ||
        (lower(title) == lower($title) && $author in authors)
      )
    ][0]{_id, title}`,
    {
      bookType: BOOK_TYPE,
      googleBooksId: googleBooksId ?? null,
      isbn13: isbn13 ?? null,
      isbn10: isbn10 ?? null,
      title,
      author: authors[0],
    },
  )
}

function makeBookDocument(book: GoogleBook) {
  const info = book.volumeInfo ?? {}
  const isbn13 = getIdentifier(info.industryIdentifiers, 'ISBN_13')
  const isbn10 = getIdentifier(info.industryIdentifiers, 'ISBN_10')
  const stableIdentity = isbn13 ?? isbn10 ?? `google-${book.id}`
  const id = `book.google.${shortHash(stableIdentity)}`

  return {
    _id: id,
    _type: BOOK_TYPE,
    catalogReviewStatus: 'needsReview',
    catalogSource: 'bookClubImport',
    title: info.title ?? 'Untitled',
    subtitle: info.subtitle ?? null,
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
      googleBooks: info.canonicalVolumeLink ?? info.infoLink ?? info.previewLink ?? null,
    },
    metadataSource: 'googleBooks',
    metadataImportedAt: new Date().toISOString(),
  }
}

type ImportResult = {
  selectionNumber: number
  year: number
  month: string
  title: string
  requestedAuthors: string[]
  sourceUrl?: string
  bookId?: string
  googleBooksId?: string
  matchedTitle?: string
  matchedAuthors?: string[]
  score?: number
  status: 'created' | 'existing' | 'needs-review' | 'error'
  error?: string
}

async function importPick(pick: Service95Pick): Promise<ImportResult> {
  console.log(`\n[${pick.selectionNumber}/${SERVICE95_PICKS.length}] ${pick.month} ${pick.year}: ${pick.title} — ${pick.authors.join(', ')}`)

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
        sourceUrl: pick.sourceUrl,
        status: 'needs-review',
      }
    }

    console.log(`  Google: ${best.book.volumeInfo?.title} — ${best.book.volumeInfo?.authors?.join(', ') ?? 'Unknown'}`)
    console.log(`  Match score: ${best.score}`)

    if (best.score < 80) {
      console.warn('  ⚠ Low-confidence match; skipped')
      return {
        selectionNumber: pick.selectionNumber,
        year: pick.year,
        month: pick.month,
        title: pick.title,
        requestedAuthors: pick.authors,
        sourceUrl: pick.sourceUrl,
        matchedTitle: best.book.volumeInfo?.title,
        matchedAuthors: best.book.volumeInfo?.authors,
        googleBooksId: best.book.id,
        score: best.score,
        status: 'needs-review',
      }
    }

    const info = best.book.volumeInfo ?? {}
    const existing = await findExistingBook({
      googleBooksId: best.book.id,
      isbn13: getIdentifier(info.industryIdentifiers, 'ISBN_13'),
      isbn10: getIdentifier(info.industryIdentifiers, 'ISBN_10'),
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
        sourceUrl: pick.sourceUrl,
        matchedTitle: best.book.volumeInfo?.title,
        matchedAuthors: best.book.volumeInfo?.authors,
        googleBooksId: best.book.id,
        score: best.score,
        bookId: existing._id,
        status: 'existing',
      }
    }

    const document = makeBookDocument(best.book)
    await sanity.createIfNotExists(document)
    console.log(`  ✓ Created ${document._id}`)

    return {
      selectionNumber: pick.selectionNumber,
      year: pick.year,
      month: pick.month,
      title: pick.title,
      requestedAuthors: pick.authors,
      sourceUrl: pick.sourceUrl,
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
      sourceUrl: pick.sourceUrl,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  console.log('Everlogue — Service95 Book Club importer')
  console.log('========================================')
  console.log(`Selections: ${SERVICE95_PICKS.length}`)

  const results: ImportResult[] = []
  for (const pick of SERVICE95_PICKS) {
    results.push(await importPick(pick))
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  const successful = results.filter((result) => (result.status === 'created' || result.status === 'existing') && result.bookId)
  const needsReview = results.filter((result) => result.status === 'needs-review' || result.status === 'error')

  console.log('\n========================================')
  console.log('Book import complete')
  console.log(`Resolved: ${successful.length}`)
  console.log(`Needs review: ${needsReview.length}`)

  const collectionEntries = results
    .filter((result) => result.bookId)
    .sort((a, b) => a.selectionNumber - b.selectionNumber)
    .map((result) => ({
      _key: `service95-${String(result.selectionNumber).padStart(3, '0')}`,
      _type: 'curatedCollectionEntry',
      selectionNumber: result.selectionNumber,
      month: result.month,
      year: result.year,
      selectionDate: `${result.year}-${String(new Date(`${result.month} 1, ${result.year}`).getMonth() + 1).padStart(2, '0')}`,
      book: {_type: 'reference', _ref: result.bookId!},
    }))

  await sanity.createOrReplace({
    _id: COLLECTION_ID,
    _type: COLLECTION_TYPE,
    title: 'Service95 Book Club',
    slug: {_type: 'slug', current: 'service95-book-club'},
    collectionType: 'celebrityBookClub',
    curator: {name: 'Dua Lipa'},
    description:
      "Dua Lipa's monthly Service95 reads, from the June 2023 launch through the latest pick. Other Service95 reading lists are excluded.",
    source: {name: 'Service95 Book Club', url: SOURCE_URL},
    totalSelections: SERVICE95_PICKS.length,
    books: collectionEntries,
    lastSyncedAt: new Date().toISOString(),
  })

  console.log(`\n✓ Collection saved with ${collectionEntries.length}/${SERVICE95_PICKS.length} resolved selections`)

  await writeFile(
    'service95-import-report.json',
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        requestedSelections: SERVICE95_PICKS.length,
        resolvedSelections: successful.length,
        needsReview: needsReview.length,
        results,
      },
      null,
      2,
    ),
  )
  console.log('✓ Wrote service95-import-report.json')

  if (needsReview.length) {
    console.log('\nSome titles need manual verification. Nothing low-confidence was inserted.')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
