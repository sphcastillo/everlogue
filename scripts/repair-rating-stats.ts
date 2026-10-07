/**
 * Recounts book.ratingStats from live rating documents.
 *
 *   pnpm tsx scripts/repair-rating-stats.ts --dry-run
 *   pnpm tsx scripts/repair-rating-stats.ts
 */

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
  token: TOKEN,
  apiVersion: '2026-09-01',
  useCdn: false,
  perspective: 'raw',
})

function statsFor(values: number[]) {
  const valid = values.filter((value) => value > 0 && value <= 5)
  return {
    _type: 'ratingStats' as const,
    count: valid.length,
    average: valid.length
      ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100
      : 0,
    updatedAt: new Date().toISOString(),
  }
}

async function main() {
  const books = await sanity.fetch<{_id: string; title: string; values: number[]; statsCount: number; statsAverage: number | null}[]>(
    `*[_type == "book" && !(_id in path("drafts.**")) && defined(ratingStats.count) && ratingStats.count != count(*[_type == "rating" && book._ref == ^._id])]{
      _id,
      title,
      "statsCount": ratingStats.count,
      "statsAverage": ratingStats.average,
      "values": *[_type == "rating" && book._ref == ^._id].value
    }`,
  )
  console.log(`${DRY_RUN ? 'Dry run: ' : ''}repair ${books.length} books on ${DATASET}`)
  for (const book of books) {
    const next = statsFor(book.values.filter((value) => typeof value === 'number'))
    console.log(`${book.title.trim()}  stats ${book.statsCount}/${book.statsAverage} → ${next.count}/${next.average}`)
    if (!DRY_RUN) {
      await sanity.patch(book._id).set({ratingStats: next}).commit({visibility: 'sync'})
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
