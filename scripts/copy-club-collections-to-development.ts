/**
 * Copies the four celebrity book-club collections and their catalog books
 * from production into development. Existing development documents are kept.
 *
 *   pnpm tsx scripts/copy-club-collections-to-development.ts
 */

import {config} from 'dotenv'
import {createClient, type SanityClient} from '@sanity/client'
import {CLUBS} from '../src/lib/book-club-watch/model'

config({path: ['.env.local', '.env'], quiet: true})

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const TOKEN = process.env.SANITY_API_WRITE_TOKEN
if (!PROJECT_ID || !TOKEN) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_WRITE_TOKEN')

const COLLECTION_IDS = Object.values(CLUBS).map((club) => club.collectionId)
const STRIP = new Set(['_rev', '_updatedAt', '_originalId'])
const DROP_FROM_BOOKS = new Set(['watchDiscovery', 'pendingImportPlacements', 'ratingStats'])

const source = createClient({
  projectId: PROJECT_ID, dataset: 'production', token: TOKEN,
  apiVersion: '2026-09-01', useCdn: false, perspective: 'published',
})
const dest = createClient({
  projectId: PROJECT_ID, dataset: 'development', token: TOKEN,
  apiVersion: '2026-09-01', useCdn: false, perspective: 'raw',
})

type Doc = Record<string, unknown> & {_id: string; _type: string}

function clean(doc: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(doc).filter(([key]) => !STRIP.has(key)))
}

function walk(value: unknown, visit: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit)
    return
  }
  const node = value as Record<string, unknown>
  visit(node)
  for (const item of Object.values(node)) walk(item, visit)
}

function refsOf(docs: Record<string, unknown>[], types?: string[]) {
  const ids = new Set<string>()
  for (const doc of docs) {
    walk(doc, (node) => {
      const ref = typeof node._ref === 'string' ? node._ref : ''
      if (!ref || ref.startsWith('image-') || ref.startsWith('file-')) return
      if (!types || types.some((type) => ref.startsWith(type) || true)) ids.add(ref)
    })
  }
  return [...ids]
}

function assetIdsOf(docs: Record<string, unknown>[]) {
  const ids = new Set<string>()
  for (const doc of docs) {
    walk(doc, (node) => {
      const ref = typeof node._ref === 'string' ? node._ref : ''
      if (ref.startsWith('image-') || ref.startsWith('file-')) ids.add(ref)
    })
  }
  return [...ids]
}

function rewriteAssets(doc: Record<string, unknown>, map: Map<string, string>) {
  walk(doc, (node) => {
    const ref = typeof node._ref === 'string' ? node._ref : ''
    if (map.has(ref)) node._ref = map.get(ref)
  })
  return doc
}

async function fetchDocs(client: SanityClient, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  const docs: Doc[] = []
  for (let index = 0; index < unique.length; index += 80) {
    const slice = unique.slice(index, index + 80)
    const batch = await client.fetch<Doc[]>(
      `*[_id in $ids && !(_id in path("drafts.**"))]`,
      {ids: slice},
      {cache: 'no-store'},
    )
    docs.push(...batch)
  }
  return docs
}

async function existingIds(client: SanityClient, ids: string[]) {
  const found = new Set<string>()
  for (let index = 0; index < ids.length; index += 80) {
    const slice = ids.slice(index, index + 80)
    const batch = await client.fetch<string[]>(
      `*[_id in $ids]._id`,
      {ids: slice},
      {cache: 'no-store'},
    )
    for (const id of batch) found.add(id)
  }
  return found
}

function typeRank(type: string) {
  return {genre: 0, author: 1, bookSeries: 2, catalogImportIdentity: 3, book: 4, edition: 5}[type] ?? 6
}

async function writeMissing(docs: Doc[]) {
  if (!docs.length) return 0
  const written = await existingIds(dest, docs.map((doc) => doc._id))
  const remaining = docs.filter((doc) => !written.has(doc._id)).sort((left, right) => typeRank(left._type) - typeRank(right._type))
  let created = 0
  while (remaining.length) {
    const ready = remaining.filter((doc) => {
      if (doc._type !== 'genre') return true
      const parent = (doc.parent as {_ref?: string} | undefined)?._ref
      return !parent || written.has(parent)
    })
    const batch = (ready.length ? ready : remaining).slice(0, 20)
    let tx = dest.transaction()
    for (const doc of batch) tx = tx.createIfNotExists(clean(doc) as {_id: string; _type: string})
    await tx.commit({visibility: 'sync'})
    for (const doc of batch) {
      written.add(doc._id)
      const index = remaining.findIndex((item) => item._id === doc._id)
      if (index >= 0) remaining.splice(index, 1)
    }
    created += batch.length
    console.log(`Wrote ${created} missing documents`)
  }
  return created
}

async function writeReplace(docs: Doc[]) {
  for (let index = 0; index < docs.length; index += 10) {
    let tx = dest.transaction()
    for (const doc of docs.slice(index, index + 10)) {
      tx = tx.createOrReplace(clean(doc) as {_id: string; _type: string})
    }
    await tx.commit({visibility: 'sync'})
  }
}

async function copyAssets(ids: string[]) {
  const map = new Map<string, string>()
  const present = await existingIds(dest, ids)
  for (const id of present) map.set(id, id)
  for (const id of ids) {
    if (map.has(id)) continue
    const asset = await source.getDocument<{
      _type?: string; url?: string; originalFilename?: string; mimeType?: string
    }>(id)
    if (!asset?.url) continue
    const response = await fetch(asset.url)
    if (!response.ok) continue
    const uploaded = await dest.assets.upload(
      asset._type === 'sanity.fileAsset' ? 'file' : 'image',
      Buffer.from(await response.arrayBuffer()),
      {filename: asset.originalFilename || 'cover.jpg', contentType: asset.mimeType},
    )
    map.set(id, uploaded._id)
    if (map.size % 20 === 0) console.log(`Assets ${map.size}/${ids.length}`)
  }
  return map
}

async function fetchGenreTree(ids: string[]) {
  const seen = new Set<string>()
  const docs: Doc[] = []
  let pending = [...ids]
  while (pending.length) {
    const batch = pending.filter((id) => !seen.has(id))
    pending = []
    if (!batch.length) break
    const found = await fetchDocs(source, batch)
    for (const doc of found) {
      seen.add(doc._id)
      docs.push(doc)
      const parent = (doc.parent as {_ref?: string} | undefined)?._ref
      if (parent && !seen.has(parent)) pending.push(parent)
    }
  }
  return docs
}

async function main() {
  console.log('Fetching production collections')
  const collections = await fetchDocs(source, COLLECTION_IDS)
  if (collections.length !== COLLECTION_IDS.length) {
    throw new Error(`Expected ${COLLECTION_IDS.length} collections, found ${collections.length}`)
  }

  const bookIds = [...new Set(collections.flatMap((collection) => {
    const books = collection.books as Array<{book?: {_ref?: string}}> | undefined
    return (books || []).map((entry) => entry.book?._ref).filter((id): id is string => Boolean(id))
  }))]
  console.log(`Fetching ${bookIds.length} production books`)
  const books = await fetchDocs(source, bookIds)
  const preparedBooks = books.map((book) => {
    const next = {...book}
    for (const key of DROP_FROM_BOOKS) delete next[key]
    return next
  })

  const authorIds = preparedBooks.flatMap((book) =>
    ((book.authorReferences as Array<{_ref?: string}> | undefined) || []).map((item) => item._ref).filter((id): id is string => Boolean(id)),
  )
  const genreIds = preparedBooks.flatMap((book) =>
    ((book.genres as Array<{_ref?: string}> | undefined) || []).map((item) => item._ref).filter((id): id is string => Boolean(id)),
  )
  const seriesIds = preparedBooks.flatMap((book) =>
    ((book.series as Array<{bookSeries?: {_ref?: string}}> | undefined) || [])
      .map((item) => item.bookSeries?._ref)
      .filter((id): id is string => Boolean(id)),
  )
  const importKeys = preparedBooks.map((book) => book.importKey).filter((key): key is string => typeof key === 'string' && Boolean(key))

  console.log(`Fetching supporting docs for ${preparedBooks.length} books`)
  const editions: Doc[] = []
  for (let index = 0; index < bookIds.length; index += 40) {
    const slice = bookIds.slice(index, index + 40)
    const batch = await source.fetch<Doc[]>(
      `*[_type == "edition" && book._ref in $ids && !(_id in path("drafts.**"))]`,
      {ids: slice},
      {cache: 'no-store'},
    )
    editions.push(...batch)
    console.log(`Editions ${Math.min(index + 40, bookIds.length)}/${bookIds.length}`)
  }
  const [authors, genres, series, identities] = await Promise.all([
    fetchDocs(source, authorIds),
    fetchGenreTree(genreIds),
    fetchDocs(source, seriesIds),
    importKeys.length
      ? source.fetch<Doc[]>(
        `*[_type == "catalogImportIdentity" && importKey in $keys && !(_id in path("drafts.**"))]`,
        {keys: importKeys},
        {cache: 'no-store'},
      )
      : Promise.resolve([]),
  ])
  console.log(`Authors ${authors.length}, genres ${genres.length}, series ${series.length}, editions ${editions.length}`)

  const catalog = [...genres, ...authors, ...series, ...preparedBooks, ...editions, ...identities, ...collections]
  const assetIds = assetIdsOf(catalog)
  console.log(`Copying ${assetIds.length} assets`)
  const assets = await copyAssets(assetIds)
  const rewritten = catalog.map((doc) => rewriteAssets(structuredClone(doc), assets) as Doc)
  const collectionsReady = rewritten.filter((doc) => doc._type === 'curatedCollection')
  const supporting = rewritten.filter((doc) => doc._type !== 'curatedCollection')

  console.log(`Writing ${supporting.length} supporting documents`)
  const created = await writeMissing(supporting)
  console.log(`Replacing ${collectionsReady.length} collections`)
  await writeReplace(collectionsReady)

  const check = await dest.fetch<{title: string; count: number}[]>(
    `*[_id in $ids]{title, "count": count(books)}`,
    {ids: COLLECTION_IDS},
    {cache: 'no-store'},
  )
  console.log(JSON.stringify({
    productionBooks: bookIds.length,
    copiedSupporting: created,
    collections: check,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
