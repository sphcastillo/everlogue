/**
 * Fills pending Oprah's Book Club imports from docs/Oprah-Book-Club-First-50.md.
 * Reviewed books are skipped. No edition documents are created or changed.
 *
 *   pnpm tsx scripts/fill-oprah-first-50.ts --dry-run
 *   pnpm tsx scripts/fill-oprah-first-50.ts
 */

import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {config} from 'dotenv'
import {createClient} from '@sanity/client'

config({path: ['.env.local', '.env'], quiet: true})

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const TOKEN = process.env.SANITY_API_WRITE_TOKEN
const DRY_RUN = process.argv.includes('--dry-run')

if (!PROJECT_ID) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID')
if (!TOKEN) throw new Error('Missing SANITY_API_WRITE_TOKEN')

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2026-09-01',
  token: TOKEN,
  useCdn: false,
})

const COLLECTION_ID = 'curatedCollection.oprahs-book-club'
const CATALOG_PATH = resolve('docs/Oprah-Book-Club-First-50.md')
const CATALOG_COUNT = 50

type CatalogEntry = {
  catalogNumber: number
  title: string
  authors: string[]
  description?: string
  isbn13?: string
  publisher?: string
  publishedDate?: string
  pageCount?: number
  genres: string[]
  clubUrl?: string
  metadataSourceUrl?: string
}

type CollectionBook = {
  bookId?: string
  title?: string
  catalogReviewStatus?: string | null
}

type GenreRow = {_id: string; title?: string}

function key() {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function titlesRelated(left: string, right: string) {
  const normalizedLeft = normalize(left)
  const normalizedRight = normalize(right)
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(normalizedRight) ||
    normalizedRight.startsWith(normalizedLeft)
  )
}

function parseAuthors(value: string) {
  return value
    .split(/\s+(?:and|&)\s+|;\s*/i)
    .map((author) => author.trim())
    .filter(Boolean)
}

function parseCatalog(markdown: string): CatalogEntry[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .flatMap((block) => {
      const heading = block.match(/^(\d+)\.\s+(.+?)\s*$/m)
      if (!heading) return []

      const authorLine = block.match(/^\*\*Author:\*\*\s+(.+)$/m)?.[1]?.trim()
      const pageCount = Number(block.match(/- \*\*Page count:\*\*\s+(\d+)/)?.[1])
      const genres = (block.match(/- \*\*Suggested genres:\*\*\s+(.+)$/m)?.[1] || '')
        .split(';')
        .map((genre) => genre.trim())
        .filter(Boolean)

      return [{
        catalogNumber: Number(heading[1]),
        title: heading[2].trim(),
        authors: authorLine ? parseAuthors(authorLine) : [],
        description: block.match(/### Description\s+([\s\S]*?)\s+### Book metadata/)?.[1]?.trim(),
        isbn13: block.match(/- \*\*ISBN-13:\*\*\s+(\d{13})/)?.[1],
        publisher: block.match(/- \*\*Publisher:\*\*\s+(.+)$/m)?.[1]?.trim(),
        publishedDate: block.match(/- \*\*Publication date:\*\*\s+(.+)$/m)?.[1]?.trim(),
        pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
        genres,
        clubUrl: block.match(/- \[Oprah book-club page\]\((https?:\/\/[^)]+)\)/)?.[1],
        metadataSourceUrl: block.match(/- \[Metadata source\]\((https?:\/\/[^)]+)\)/)?.[1],
      }]
    })
}

async function ensureGenres(names: string[], existing: GenreRow[]) {
  const byName = new Map(
    existing
      .filter((genre) => genre.title)
      .map((genre) => [normalize(genre.title!), genre]),
  )
  const ids = new Map<string, string>()

  for (const name of names) {
    const found = byName.get(normalize(name))
    if (found) {
      ids.set(name, found._id)
      continue
    }
    if (DRY_RUN) {
      ids.set(name, `dry-run-genre.${slugify(name)}`)
      continue
    }
    const created = await sanity.create({
      _type: 'genre',
      title: name,
      slug: {_type: 'slug', current: slugify(name)},
    })
    byName.set(normalize(name), created)
    ids.set(name, created._id)
    console.log(`Created genre: ${name}`)
  }

  return ids
}

function knowledgeSources(entry: CatalogEntry) {
  return [
    entry.clubUrl && {label: "Oprah's Book Club", url: entry.clubUrl},
    entry.metadataSourceUrl && {label: 'Bibliographic source', url: entry.metadataSourceUrl},
  ]
    .filter((source): source is {label: string; url: string} => Boolean(source))
    .map((source) => ({_type: 'knowledgeSource', _key: key(), ...source}))
}

async function main() {
  const catalog = parseCatalog(await readFile(CATALOG_PATH, 'utf8'))
  if (catalog.length !== CATALOG_COUNT) {
    throw new Error(`Expected ${CATALOG_COUNT} catalog entries, parsed ${catalog.length}`)
  }

  const collection = await sanity.fetch<{books?: CollectionBook[]} | null>(
    `*[_id == $id][0]{
      books[]{
        "bookId": book._ref,
        "title": book->title,
        "catalogReviewStatus": book->catalogReviewStatus
      }
    }`,
    {id: COLLECTION_ID},
  )
  const collectionByTitle = new Map(
    (collection?.books || [])
      .filter((book) => book.title)
      .map((book) => [normalize(book.title!), book]),
  )
  const findCollectionBook = (title: string) =>
    collectionByTitle.get(normalize(title)) ||
    (collection?.books || []).find((book) => book.title && titlesRelated(title, book.title))

  const pending = catalog.filter((entry) => {
    const book = findCollectionBook(entry.title)
    return book?.bookId && book.catalogReviewStatus !== 'reviewed'
  })
  const existingGenres = await sanity.fetch<GenreRow[]>(
    `*[_type == "genre" && !(_id in path("drafts.**"))]{_id, title}`,
  )
  const genreIds = await ensureGenres(
    [...new Set(pending.flatMap((entry) => entry.genres))],
    existingGenres,
  )

  const unmatched: string[] = []
  const reviewed: string[] = []
  let updated = 0

  for (const entry of catalog) {
    const book = findCollectionBook(entry.title)
    if (!book?.bookId) {
      unmatched.push(`#${entry.catalogNumber} ${entry.title}`)
      continue
    }
    if (book.catalogReviewStatus === 'reviewed') {
      reviewed.push(`#${entry.catalogNumber} ${entry.title}`)
      continue
    }

    const fields = {
      authors: entry.authors,
      description: entry.description,
      isbn13: entry.isbn13,
      publisher: entry.publisher,
      publishedDate: entry.publishedDate,
      pageCount: entry.pageCount,
      categories: entry.genres,
      catalogSource: 'bookClubImport',
      knowledgeSources: knowledgeSources(entry),
      genres: entry.genres.map((name) => ({
        _type: 'reference',
        _key: key(),
        _ref: genreIds.get(name),
      })),
    }

    if (!DRY_RUN) {
      await sanity
        .patch(book.bookId)
        .set(fields)
        .setIfMissing({isStandalone: true})
        .commit({visibility: 'sync'})
    }
    updated += 1
  }

  console.log(
    `${DRY_RUN ? 'Dry run:' : 'Updated'} ${updated} pending Oprah books in ${DATASET}. ` +
      `Skipped ${reviewed.length} reviewed. Unmatched ${unmatched.length}.`,
  )
  if (reviewed.length) {
    console.log('Skipped reviewed:')
    for (const title of reviewed) console.log(`  ${title}`)
  }
  if (unmatched.length) {
    console.log('Not found in the Oprah collection:')
    for (const title of unmatched) console.log(`  ${title}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
