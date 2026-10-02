/**
 * Fills Reese collection books from docs/Reeses-Book-Club-Complete-Catalog.md.
 * Updates book documents only. Does not create or change editions.
 *
 *   pnpm tsx scripts/fill-reese-catalog.ts
 *   pnpm tsx scripts/fill-reese-catalog.ts --dry-run
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

const COLLECTION_ID = 'curatedCollection.reeses-book-club'
const CATALOG_PATH = resolve('docs/Reeses-Book-Club-Complete-Catalog.md')

type CatalogEntry = {
  catalogNumber: number
  selectionNumber: number
  title: string
  authors: string[]
  audience?: string
  description?: string
  isbn13?: string
  publisher?: string
  publishedDate?: string
  pageCount?: number
  reeseUrl?: string
  metadataSourceUrl?: string
  genres: string[]
}

type CollectionBook = {
  selectionNumber?: number
  bookId?: string
  title?: string
}

type GenreRow = {_id: string; title?: string}

function key() {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeGenre(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseAuthors(value: string) {
  return value
    .split(/\s*(?:,|\band\b|&)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

function markdownLinkUrl(value: string) {
  return value.match(/\((https?:\/\/[^)]+)\)/)?.[1]
}

function parseCatalog(markdown: string): CatalogEntry[] {
  const blocks = markdown.split(/^## /m).slice(1)
  const entries: CatalogEntry[] = []

  for (const block of blocks) {
    const heading = block.match(/^(\d+)\.\s+(.+?)\s*$/m)
    if (!heading) continue

    const catalogNumber = Number(heading[1])
    const title = heading[2].trim()
    const authorLine = block.match(/^\*\*Author:\*\*\s+(.+)$/m)?.[1]?.trim()
    const audience = block.match(/^\*\*Audience:\*\*\s+(.+)$/m)?.[1]?.trim()
    const description = block.match(/\*\*Description:\*\*\s+([\s\S]*?)(?:\n\n- \*\*|$)/)?.[1]?.trim()
    const isbn13 = block.match(/- \*\*ISBN-13:\*\*\s+(\d{13})/)?.[1]
    const publisher = block.match(/- \*\*Publisher:\*\*\s+(.+)$/m)?.[1]?.trim()
    const publishedDate = block.match(/- \*\*Publication date:\*\*\s+(.+)$/m)?.[1]?.trim()
    const pageCount = Number(block.match(/- \*\*Page count:\*\*\s+(\d+)/)?.[1])
    const reeseUrl = markdownLinkUrl(block.match(/- \*\*Reese.+?URL:\*\*\s+(.+)$/m)?.[1] || '')
    const metadataSourceUrl = markdownLinkUrl(block.match(/- \*\*Metadata source:\*\*\s+(.+)$/m)?.[1] || '')
    const genres = (block.match(/- \*\*Genres:\*\*\s+(.+)$/m)?.[1] || '')
      .split(';')
      .map((genre) => genre.trim())
      .filter(Boolean)

    entries.push({
      catalogNumber,
      selectionNumber: 130 - catalogNumber,
      title,
      authors: authorLine ? parseAuthors(authorLine) : [],
      audience,
      description,
      isbn13,
      publisher,
      publishedDate,
      pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
      reeseUrl,
      metadataSourceUrl,
      genres,
    })
  }

  return entries
}

function titlesRelated(catalogTitle: string, bookTitle: string) {
  const catalog = normalizeTitle(catalogTitle)
  const book = normalizeTitle(bookTitle)
  if (!catalog || !book) return false
  if (catalog === book) return true
  if (catalog.startsWith(book) || book.startsWith(catalog)) return true
  const catalogWords = new Set(catalog.split(' ').filter((word) => word.length > 2))
  const shared = book.split(' ').filter((word) => catalogWords.has(word)).length
  return shared >= 2
}

function knowledgeSources(entry: CatalogEntry) {
  const sources = [
    entry.reeseUrl && {label: "Reese's Book Club", url: entry.reeseUrl},
    entry.metadataSourceUrl && {label: 'Bibliographic source', url: entry.metadataSourceUrl},
  ].filter((source): source is {label: string; url: string} => Boolean(source))

  return sources.map((source) => ({
    _type: 'knowledgeSource',
    _key: key(),
    label: source.label,
    url: source.url,
  }))
}

async function ensureGenres(names: string[], existing: GenreRow[]) {
  const byName = new Map(
    existing
      .filter((genre) => genre.title)
      .map((genre) => [normalizeGenre(genre.title!), genre]),
  )
  const ids = new Map<string, string>()

  for (const name of names) {
    const normalized = normalizeGenre(name)
    const found = byName.get(normalized)
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
    byName.set(normalized, created)
    ids.set(name, created._id)
    console.log(`Created genre: ${name}`)
  }

  return ids
}

async function main() {
  const markdown = await readFile(CATALOG_PATH, 'utf8')
  const catalog = parseCatalog(markdown)
  if (catalog.length !== 129) {
    throw new Error(`Expected 129 catalog entries, parsed ${catalog.length}`)
  }

  const collection = await sanity.fetch<{books?: CollectionBook[]} | null>(
    `*[_id == $id][0]{books[]{selectionNumber, "bookId": book._ref, "title": book->title}}`,
    {id: COLLECTION_ID},
  )
  const books = collection?.books || []
  if (books.length !== 129) {
    throw new Error(`Expected 129 Reese collection books, found ${books.length}`)
  }

  const existingGenres = await sanity.fetch<GenreRow[]>(
    `*[_type == "genre" && !(_id in path("drafts.**"))]{_id, title}`,
  )
  const neededGenres = [...new Set(catalog.flatMap((entry) => entry.genres))]
  const genreIds = await ensureGenres(neededGenres, existingGenres)

  const unmatched: string[] = []
  const titleWarnings: string[] = []
  let patched = 0

  for (const entry of catalog) {
    const book = books.find((item) => item.selectionNumber === entry.selectionNumber)
    if (!book?.bookId) {
      unmatched.push(`#${entry.catalogNumber} ${entry.title}`)
      continue
    }
    if (book.title && !titlesRelated(entry.title, book.title)) {
      titleWarnings.push(
        `Catalog #${entry.catalogNumber} "${entry.title}" vs collection #${entry.selectionNumber} "${book.title}"`,
      )
    }

    const set: Record<string, unknown> = {
      authors: entry.authors,
      description: entry.description,
      isbn13: entry.isbn13,
      publisher: entry.publisher,
      publishedDate: entry.publishedDate,
      pageCount: entry.pageCount,
      categories: entry.genres,
      knowledgeSources: knowledgeSources(entry),
      genres: entry.genres.map((name) => ({
        _type: 'reference',
        _ref: genreIds.get(name),
        _key: key(),
      })),
    }

    if (DRY_RUN) {
      patched += 1
      continue
    }

    await sanity.patch(book.bookId).set(set).commit({visibility: 'async'})
    patched += 1
  }

  console.log(
    `${DRY_RUN ? 'Dry run' : 'Updated'} ${patched} Reese books in ${DATASET} from the complete catalog.`,
  )
  if (titleWarnings.length) {
    console.log(`Title checks to review (${titleWarnings.length}):`)
    for (const warning of titleWarnings) console.log(`  ${warning}`)
  }
  if (unmatched.length) {
    throw new Error(`Unmatched catalog entries: ${unmatched.join('; ')}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
