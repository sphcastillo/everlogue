/**
 * Backfills books without series metadata as standalone.
 *
 *   pnpm tsx scripts/set-books-standalone-default.ts --dry-run
 *   pnpm tsx scripts/set-books-standalone-default.ts
 */

import {config} from 'dotenv'
import {createClient} from '@sanity/client'

config({path: ['.env.local', '.env'], quiet: true})

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const token = process.env.SANITY_API_WRITE_TOKEN
const dryRun = process.argv.includes('--dry-run')

if (!projectId) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID')
if (!token) throw new Error('Missing SANITY_API_WRITE_TOKEN')

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2026-09-01',
  useCdn: false,
  perspective: 'raw',
})

type BookRow = {_id: string}

async function main() {
  const books = await client.fetch<BookRow[]>(
    `*[_type == "book" && !defined(isStandalone) && !defined(series.name)]{_id}`,
  )

  if (dryRun) {
    console.log(`Dry run: ${books.length} book documents would be marked standalone in ${dataset}.`)
    return
  }

  for (let index = 0; index < books.length; index += 100) {
    let transaction = client.transaction()
    for (const book of books.slice(index, index + 100)) {
      transaction = transaction.patch(book._id, {set: {isStandalone: true}})
    }
    await transaction.commit({visibility: 'sync'})
  }

  console.log(`Marked ${books.length} book documents standalone in ${dataset}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
