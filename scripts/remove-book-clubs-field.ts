/**
 * Copies any leftover book.clubs tags onto curated collection lists, then
 * removes clubs from book documents.
 *
 *   pnpm tsx scripts/remove-book-clubs-field.ts
 */

import {randomUUID} from 'node:crypto'
import {config} from 'dotenv'
import {createClient} from '@sanity/client'

config({path: ['.env.local', '.env'], quiet: true})

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const TOKEN = process.env.SANITY_API_WRITE_TOKEN

if (!PROJECT_ID) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID')
if (!TOKEN) throw new Error('Missing SANITY_API_WRITE_TOKEN')

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2026-09-01',
  token: TOKEN,
  useCdn: false,
})

type BookRow = {_id: string; clubs?: {_ref?: string}[] | null}

function publishedId(id: string) {
  return id.replace(/^drafts\./, '')
}

async function ensureOnCollection(clubId: string, bookId: string) {
  const collection = await sanity.fetch<{
    books?: {book?: {_ref?: string}; selectionNumber?: number}[]
  } | null>(`*[_id == $clubId][0]{books[]{book, selectionNumber}}`, {clubId})
  const books = collection?.books || []
  if (books.some((entry) => entry.book?._ref === bookId)) return false
  const nextNumber = Math.max(0, ...books.map((entry) => entry.selectionNumber || 0)) + 1
  const entry = {
    _type: 'curatedCollectionEntry',
    _key: randomUUID().replace(/-/g, '').slice(0, 12),
    book: {_type: 'reference', _ref: bookId},
    selectionNumber: nextNumber,
  }
  if (!books.length) {
    await sanity.patch(clubId).set({books: [entry]}).commit({visibility: 'sync'})
  } else {
    await sanity.patch(clubId).insert('after', 'books[-1]', [entry]).commit({visibility: 'sync'})
  }
  return true
}

async function main() {
  const tagged = await sanity.fetch<BookRow[]>(
    `*[_type == "book" && defined(clubs)]{_id, clubs}`,
  )
  let copied = 0
  for (const book of tagged) {
    const bookId = publishedId(book._id)
    for (const club of book.clubs || []) {
      if (!club._ref) continue
      if (await ensureOnCollection(club._ref, bookId)) copied += 1
    }
  }

  let cleared = 0
  for (const book of tagged) {
    await sanity.patch(book._id).unset(['clubs']).commit({visibility: 'sync'})
    cleared += 1
  }

  console.log(`Copied ${copied} missing collection entries, cleared clubs on ${cleared} books.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
