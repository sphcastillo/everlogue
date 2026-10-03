/**
 * Fills Read with Jenna collection books from docs/Read-With-Jenna-Complete-Catalog.md.
 * Skips books marked Reviewed. Does not create or change editions.
 *
 *   pnpm tsx scripts/fill-jenna-catalog.ts
 *   pnpm tsx scripts/fill-jenna-catalog.ts --dry-run
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

const COLLECTION_ID = 'curatedCollection.read-with-jenna'
const CATALOG_PATH = resolve('docs/Read-With-Jenna-Complete-Catalog.md')
const CATALOG_COUNT = 94

type CatalogEntry = {
  catalogNumber: number
  selectionNumber: number
  title: string
  authors: string[]
  description?: string
  isbn13?: string
  publisher?: string
  publishedDate?: string
  pageCount?: number
  clubUrl?: string
  metadataSourceUrl?: string
  genres: string[]
  selectionMonth?: string
  selectionYear?: number
}

type CollectionBook = {
  selectionNumber?: number
  bookId?: string
  title?: string
  catalogReviewStatus?: string | null
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

function publishedDate(value?: string) {
  if (!value) return undefined
  return value.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] || value.trim()
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
    const description = block.match(/\*\*Description:\*\*\s+([\s\S]*?)(?:\n\n- \*\*|$)/)?.[1]?.trim()
    const isbn13 = block.match(/- \*\*ISBN-13:\*\*\s+(\d{13})/)?.[1]
    const publisher = block.match(/- \*\*Publisher:\*\*\s+(.+)$/m)?.[1]?.trim()
    const pageCount = Number(block.match(/- \*\*Page count:\*\*\s+(\d+)/)?.[1])
    const clubUrl = markdownLinkUrl(block.match(/- \*\*Read with Jenna book-club URL:\*\*\s+(.+)$/m)?.[1] || '')
    const metadataSourceUrl = markdownLinkUrl(block.match(/- \*\*Metadata source:\*\*\s+(.+)$/m)?.[1] || '')
    const genres = (block.match(/- \*\*Three suggested genres:\*\*\s+(.+)$/m)?.[1] || '')
      .split(';')
      .map((genre) => genre.trim())
      .filter(Boolean)
    const selection = block
      .match(/^\*\*Read with Jenna selection:\*\*\s+([A-Za-z]+)\s+(20\d{2})$/m)

    entries.push({
      catalogNumber,
      selectionNumber: CATALOG_COUNT + 1 - catalogNumber,
      title,
      authors: authorLine ? parseAuthors(authorLine) : [],
      description,
      isbn13,
      publisher,
      publishedDate: publishedDate(block.match(/- \*\*Publication date:\*\*\s+(.+)$/m)?.[1]),
      pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
      clubUrl,
      metadataSourceUrl,
      genres,
      selectionMonth: selection?.[1],
      selectionYear: selection?.[2] ? Number(selection[2]) : undefined,
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
    entry.clubUrl && {label: 'Read with Jenna', url: entry.clubUrl},
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

function bookFields(entry: CatalogEntry, genreIds: Map<string, string>) {
  return {
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
      _ref: genreIds.get(name),
      _key: key(),
    })),
  }
}

async function findCatalogBook(entry: CatalogEntry) {
  return sanity.fetch<{_id: string; title?: string; catalogReviewStatus?: string | null} | null>(
    `*[_type == "book" && !(_id in path("drafts.**")) && title == $title][0]{_id, title, catalogReviewStatus}`,
    {title: entry.title},
  )
}

async function main() {
  const markdown = await readFile(CATALOG_PATH, 'utf8')
  const catalog = parseCatalog(markdown)
  if (catalog.length !== CATALOG_COUNT) {
    throw new Error(`Expected ${CATALOG_COUNT} catalog entries, parsed ${catalog.length}`)
  }

  const collection = await sanity.fetch<{books?: CollectionBook[]} | null>(
    `*[_id == $id][0]{books[]{selectionNumber, "bookId": book._ref, "title": book->title, "catalogReviewStatus": book->catalogReviewStatus}}`,
    {id: COLLECTION_ID},
  )
  const books = collection?.books || []

  const existingGenres = await sanity.fetch<GenreRow[]>(
    `*[_type == "genre" && !(_id in path("drafts.**"))]{_id, title}`,
  )
  const genreIds = await ensureGenres(
    [...new Set(catalog.flatMap((entry) => entry.genres))],
    existingGenres,
  )

  const unmatched: string[] = []
  const appended: string[] = []
  const skippedReviewed: string[] = []
  const titleWarnings: string[] = []
  let patched = 0
  let nextSelection = Math.max(0, ...books.map((item) => item.selectionNumber || 0))

  for (const entry of catalog) {
    let book = books.find((item) => item.selectionNumber === entry.selectionNumber)
    if (!book?.bookId) {
      const found = await findCatalogBook(entry)
      if (!found?._id) {
        unmatched.push(`#${entry.catalogNumber} ${entry.title}`)
        continue
      }
      if (found.catalogReviewStatus === 'reviewed') {
        skippedReviewed.push(`#${entry.catalogNumber} ${found.title || entry.title}`)
        continue
      }
      nextSelection += 1
      if (!DRY_RUN) {
        await sanity
          .patch(COLLECTION_ID)
          .insert('after', 'books[-1]', [
            {
              _key: `jenna-${String(nextSelection).padStart(3, '0')}`,
              _type: 'curatedCollectionEntry',
              selectionNumber: nextSelection,
              ...(entry.selectionMonth ? {month: entry.selectionMonth} : {}),
              ...(entry.selectionYear ? {year: entry.selectionYear} : {}),
              ...(entry.selectionMonth && entry.selectionYear
                ? {selectionDate: `${entry.selectionMonth} ${entry.selectionYear}`}
                : {}),
              book: {_type: 'reference', _ref: found._id},
            },
          ])
          .set({
            totalSelections: nextSelection,
            lastSyncedAt: new Date().toISOString(),
          })
          .commit({visibility: 'sync'})
      }
      book = {
        selectionNumber: nextSelection,
        bookId: found._id,
        title: found.title,
        catalogReviewStatus: found.catalogReviewStatus,
      }
      books.push(book)
      appended.push(`#${entry.catalogNumber} ${entry.title} as selection ${nextSelection}`)
    }
    if (book.catalogReviewStatus === 'reviewed') {
      skippedReviewed.push(`#${entry.catalogNumber} ${book.title || entry.title}`)
      continue
    }
    if (book.title && !titlesRelated(entry.title, book.title)) {
      titleWarnings.push(
        `Catalog #${entry.catalogNumber} "${entry.title}" vs collection #${entry.selectionNumber} "${book.title}"`,
      )
    }

    if (DRY_RUN) {
      patched += 1
      continue
    }

    const bookId = book.bookId
    if (!bookId) {
      unmatched.push(`#${entry.catalogNumber} ${entry.title}`)
      continue
    }

    await sanity.patch(bookId).set(bookFields(entry, genreIds)).commit({visibility: 'async'})
    patched += 1
  }

  console.log(
    `${DRY_RUN ? 'Dry run' : 'Updated'} ${patched} Read with Jenna books in ${DATASET}. Appended ${appended.length}. Skipped ${skippedReviewed.length} reviewed. Unmatched ${unmatched.length}.`,
  )
  if (appended.length) {
    console.log('Added to the collection:')
    for (const title of appended) console.log(`  ${title}`)
  }
  if (skippedReviewed.length) {
    console.log('Skipped reviewed:')
    for (const title of skippedReviewed) console.log(`  ${title}`)
  }
  if (unmatched.length) {
    console.log('Not in the catalog:')
    for (const title of unmatched) console.log(`  ${title}`)
  }
  if (titleWarnings.length) {
    console.log(`Title checks to review (${titleWarnings.length}):`)
    for (const warning of titleWarnings) console.log(`  ${warning}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
