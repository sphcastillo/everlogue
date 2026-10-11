/**
 * Turns imported book.isbn13 / isbn10 values into edition documents for that ISBN.
 * Fills publisher, date, pages, language, and format only when Google Books or
 * Open Library return them for that ISBN. Does not create extra formats.
 *
 *   pnpm tsx scripts/promote-book-isbns-to-editions.ts
 *   pnpm tsx scripts/promote-book-isbns-to-editions.ts --apply
 *   pnpm tsx scripts/promote-book-isbns-to-editions.ts --apply --limit=20
 */

import {config} from 'dotenv'
import {createClient} from '@sanity/client'
import {resolveEditionMetadata} from '../src/lib/edition-metadata'
import {isbnForBook, promoteBookIsbnEdition, type BookIsbnRecord} from '../src/lib/promote-book-isbn-edition'

config({path: ['.env.local', '.env'], quiet: true})

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const TOKEN = process.env.SANITY_API_WRITE_TOKEN
const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined

if (!PROJECT_ID) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID')
if (!TOKEN) throw new Error('Missing SANITY_API_WRITE_TOKEN')
if (limitArg && !Number.isFinite(LIMIT)) throw new Error(' --limit must be a number')

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2026-09-01',
  token: TOKEN,
  useCdn: false,
})

function isTransient(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code) : ''
  const status = 'statusCode' in error ? Number(error.statusCode) : 0
  return ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN'].includes(code) || [429, 502, 503, 504].includes(status)
}

async function withRetry<T>(run: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (!isTransient(error) || attempt >= 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
    }
  }
}

async function main() {
  const books = await client.fetch<BookIsbnRecord[]>(
    `*[_type == "book" && !(_id in path("drafts.**")) && (defined(isbn13) || defined(isbn10))]{_id, title, authors, isbn13, isbn10}`,
  )
  const eligible = books.filter((book) => isbnForBook(book))
  const queue = LIMIT ? eligible.slice(0, LIMIT) : eligible
  console.log(`${APPLY ? 'Apply' : 'Dry run'} ${queue.length} of ${eligible.length} ISBN books in ${DATASET}`)

  const counts = {create: 0, refresh: 0, conflict: 0, locked: 0, invalid: 0, mismatch: 0}
  for (const book of queue) {
    const result = await withRetry(() => promoteBookIsbnEdition(client, book, {apply: APPLY, resolve: resolveEditionMetadata}))
    counts[result.action]++
    if (result.titleMismatch) counts.mismatch++
    const extra = [result.reason, result.titleMismatch ? 'title/author differs from provider' : '', result.fields.format ? `format=${result.fields.format}` : 'format omitted']
      .filter(Boolean)
      .join('; ')
    console.log(`${result.action}\t${result.isbn13 || ''}\t${book.title}\t${extra}`)
  }
  console.log(counts)
}

main()
