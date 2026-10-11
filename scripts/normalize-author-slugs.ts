/**
 * Sets each author slug from their name (Studio Generate form).
 * Duplicate names get -2, -3. Does not merge author documents.
 *
 *   pnpm tsx scripts/normalize-author-slugs.ts
 *   NEXT_PUBLIC_SANITY_DATASET=production pnpm tsx scripts/normalize-author-slugs.ts --apply
 */

import {config} from 'dotenv'
import {createClient} from '@sanity/client'
import {uniqueAuthorSlug} from '../src/lib/author-slug'

config({path: ['.env.local', '.env'], quiet: true})

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const TOKEN = process.env.SANITY_API_WRITE_TOKEN
const APPLY = process.argv.includes('--apply')

if (!PROJECT_ID) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID')
if (!TOKEN) throw new Error('Missing SANITY_API_WRITE_TOKEN')

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2026-09-01',
  token: TOKEN,
  useCdn: false,
})

async function main() {
  const authors = await client.fetch<{_id: string; name: string; slug?: string}[]>(
    `*[_type == "author" && !(_id in path("drafts.**"))] | order(_createdAt asc){_id, name, "slug": slug.current}`,
  )
  const taken = new Set<string>()
  let changed = 0
  console.log(`${APPLY ? 'Apply' : 'Dry run'} ${authors.length} authors in ${DATASET}`)
  for (const author of authors) {
    const next = uniqueAuthorSlug(author.name || '', taken)
    taken.add(next)
    if (author.slug === next) continue
    changed++
    console.log(`${author.slug || '(none)'} → ${next}\t${author.name}`)
    if (APPLY) {
      await client.patch(author._id).set({slug: {_type: 'slug', current: next}}).commit({visibility: 'sync'})
    }
  }
  console.log({changed, unchanged: authors.length - changed})
}

main()
