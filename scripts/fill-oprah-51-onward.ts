/**
 * Fills Oprah selections 51–124 from docs/Oprah-Book-Club-51-Onward.md.
 * Does not create genres. Unmapped suggested genres are reported, not invented.
 *
 *   pnpm tsx scripts/fill-oprah-51-onward.ts --dry-run
 *   pnpm tsx scripts/fill-oprah-51-onward.ts
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
const CATALOG_PATH = resolve('docs/Oprah-Book-Club-51-Onward.md')

const GENRE_ALIASES: Record<string, string> = {
  'coming of age fiction': 'coming of age',
  'coming of age story': 'coming of age',
  'self help': 'self help',
}

type Source = {label: string; url: string}
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
  sources: Source[]
}
type BookRow = {
  _id: string
  title?: string
  isbn13?: string | null
  catalogReviewStatus?: string | null
  editorialLocked?: boolean | null
  genres?: {_ref: string; _key?: string}[] | null
  categories?: string[] | null
  knowledgeSources?: {label?: string; url?: string; _key?: string}[] | null
}
type GenreRow = {_id: string; title?: string}

function key() {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function titlesRelated(left: string, right: string) {
  const a = normalize(left)
  const b = normalize(right)
  return a === b || a.startsWith(b) || b.startsWith(a)
}

function parseAuthors(value: string) {
  return value.split(/\s+(?:and|&)\s+|;\s*/i).map((author) => author.trim()).filter(Boolean)
}

function parseCatalog(markdown: string): CatalogEntry[] {
  return markdown.split(/^## /m).slice(1).flatMap((block) => {
    const heading = block.match(/^(\d+)\.\s+(.+?)\s*$/m)
    if (!heading) return []
    const authorLine = block.match(/^\*\*Author:\*\*\s+(.+)$/m)?.[1]?.trim()
    const pageCount = Number(block.match(/- \*\*Page count:\*\*\s+(\d+)/)?.[1])
    const linksSection = block.split(/### Links and sources/)[1] || ''
    const sources = [...linksSection.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map((match) => ({
      label: match[1].trim(),
      url: match[2].trim(),
    }))
    return [{
      catalogNumber: Number(heading[1]),
      title: heading[2].trim(),
      authors: authorLine ? parseAuthors(authorLine) : [],
      description: block.match(/### Description\s+([\s\S]*?)\s+### Book metadata/)?.[1]?.trim(),
      isbn13: block.match(/- \*\*ISBN-13:\*\*\s+(\d{13})/)?.[1],
      publisher: block.match(/- \*\*Publisher:\*\*\s+(.+)$/m)?.[1]?.trim(),
      publishedDate: block.match(/- \*\*Publication date:\*\*\s+(.+)$/m)?.[1]?.trim(),
      pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
      genres: (block.match(/- \*\*Suggested genres:\*\*\s+(.+)$/m)?.[1] || '')
        .split(';')
        .map((genre) => genre.trim())
        .filter(Boolean),
      sources,
    }]
  })
}

function mergeSources(existing: BookRow['knowledgeSources'], incoming: Source[]) {
  const merged = new Map<string, {label: string; url: string; _key: string}>()
  for (const source of existing || []) {
    if (!source.url) continue
    merged.set(source.url, {
      _type: 'knowledgeSource',
      _key: source._key || key(),
      label: source.label || source.url,
      url: source.url,
    } as {label: string; url: string; _key: string} & {_type?: string})
  }
  for (const source of incoming) {
    if (merged.has(source.url)) continue
    merged.set(source.url, {_type: 'knowledgeSource', _key: key(), ...source} as never)
  }
  return [...merged.values()].map((source) => ({
    _type: 'knowledgeSource',
    _key: source._key,
    label: source.label,
    url: source.url,
  }))
}

function resolveGenre(name: string, byName: Map<string, GenreRow>) {
  const normalized = normalize(name)
  const aliased = GENRE_ALIASES[normalized] || normalized
  return byName.get(aliased) || byName.get(normalized)
}

async function main() {
  const catalog = parseCatalog(await readFile(CATALOG_PATH, 'utf8'))
  const collection = await sanity.fetch<{books?: {bookId?: string; title?: string}[]} | null>(
    `*[_id == $id][0]{books[]{"bookId": book._ref, "title": book->title}}`,
    {id: COLLECTION_ID},
  )
  const existingGenres = await sanity.fetch<GenreRow[]>(
    `*[_type == "genre" && !(_id in path("drafts.**"))]{_id, title}`,
  )
  const byName = new Map(
    existingGenres.filter((genre) => genre.title).map((genre) => [normalize(genre.title!), genre]),
  )
  const catalogBooks = await sanity.fetch<BookRow[]>(
    `*[_type == "book" && !(_id in path("drafts.**"))]{_id, title, isbn13, catalogReviewStatus, editorialLocked, genres, categories, knowledgeSources}`,
  )

  const unknownGenres = new Map<string, string[]>()
  const unmatched: string[] = []
  const updated: string[] = []
  const locked: string[] = []
  const seenBooks = new Set<string>()

  for (const entry of catalog) {
    const collectionMatch = (collection?.books || []).find(
      (book) => book.title && titlesRelated(entry.title, book.title),
    )
    const book =
      (entry.isbn13 && catalogBooks.find((item) => item.isbn13 === entry.isbn13)) ||
      catalogBooks.find((item) => item._id === collectionMatch?.bookId) ||
      catalogBooks.find((item) => item.title && titlesRelated(entry.title, item.title))

    if (!book) {
      unmatched.push(`#${entry.catalogNumber} ${entry.title}`)
      continue
    }
    if (seenBooks.has(book._id)) continue
    seenBooks.add(book._id)

    const mapped: {_type: string; _ref: string; _key: string}[] = []
    const seenRefs = new Set((book.genres || []).map((genre) => genre._ref))
    for (const genre of book.genres || []) {
      mapped.push({_type: 'reference', _ref: genre._ref, _key: genre._key || key()})
    }
    for (const name of entry.genres) {
      const found = resolveGenre(name, byName)
      if (!found) {
        unknownGenres.set(name, [...(unknownGenres.get(name) || []), `#${entry.catalogNumber} ${entry.title}`])
        continue
      }
      if (seenRefs.has(found._id)) continue
      seenRefs.add(found._id)
      mapped.push({_type: 'reference', _ref: found._id, _key: key()})
    }

    const categories = [...new Set([
      ...(book.categories || []),
      ...entry.genres.flatMap((name) => {
        const found = resolveGenre(name, byName)
        return found?.title ? [found.title] : []
      }),
    ])]
    const knowledgeSources = mergeSources(book.knowledgeSources, entry.sources)
    const fields: Record<string, unknown> = {
      knowledgeSources,
      catalogSource: 'bookClubImport',
      genres: mapped,
      categories,
    }
    if (entry.authors.length) fields.authors = entry.authors
    if (entry.description) fields.description = entry.description
    if (entry.isbn13) fields.isbn13 = entry.isbn13
    if (entry.publisher) fields.publisher = entry.publisher
    if (entry.publishedDate) fields.publishedDate = entry.publishedDate
    if (entry.pageCount) fields.pageCount = entry.pageCount

    const status = book.catalogReviewStatus || 'unmarked'
    if (book.editorialLocked) {
      locked.push(`#${entry.catalogNumber} ${entry.title} (${status})`)
      if (!DRY_RUN) {
        await sanity.patch(book._id).set({knowledgeSources}).commit({visibility: 'sync'})
      }
      continue
    }

    if (!DRY_RUN) {
      await sanity.patch(book._id).set(fields).setIfMissing({isStandalone: true}).commit({visibility: 'sync'})
    }
    updated.push(`#${entry.catalogNumber} ${entry.title} · ${status}`)
  }

  console.log(`${DRY_RUN ? 'Dry run:' : 'Updated'} ${updated.length} Oprah 51+ books in ${DATASET}.`)
  if (locked.length) {
    console.log(`Editorial-locked, sources only (${locked.length}):`)
    for (const row of locked) console.log(`  ${row}`)
  }
  if (unmatched.length) {
    console.log(`Not found in the catalog (${unmatched.length}):`)
    for (const row of unmatched) console.log(`  ${row}`)
  }
  if (unknownGenres.size) {
    console.log('Suggested genres with no existing catalog genre (not created):')
    for (const [name, books] of [...unknownGenres.entries()].sort()) {
      console.log(`  ${name} — ${books.join(', ')}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
