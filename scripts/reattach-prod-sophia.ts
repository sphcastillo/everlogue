import {config} from 'dotenv'
import {createClient} from '@sanity/client'

config({path: ['.env.local', '.env'], quiet: true})

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: 'production',
  token: process.env.SANITY_API_WRITE_TOKEN,
  apiVersion: '2026-09-01',
  useCdn: false,
  perspective: 'raw',
})

const KEEP = 'ngqA6mE9gKvtS1xUUXRvoX'
const EMPTY = 'OgAUDuWX5jwqflSvkkvypI'
const LIVE = 'user_3KF5X5pugW4mavCo0Mh1qxicYba'

async function main() {
  const keep = await client.fetch(`*[_id == $id][0]{_id, clerkUserId, displayName}`, {id: KEEP})
  if (!keep) throw new Error('Production library profile missing')
  await client.patch(KEEP).set({clerkUserId: LIVE}).commit({visibility: 'sync'})
  await client
    .transaction()
    .delete(EMPTY)
    .delete(`shelf-${EMPTY}-currentlyReading`)
    .delete(`shelf-${EMPTY}-finished`)
    .delete(`shelf-${EMPTY}-wantToRead`)
    .delete(`drafts.${EMPTY}`)
    .commit({visibility: 'sync'})
  const result = await client.fetch(
    `*[_type == "readerProfile" && clerkUserId == $live][0]{
      _id, clerkUserId, displayName,
      "entries": count(*[_type == "shelfEntry" && shelf->owner._ref == ^._id]),
      "ratings": count(*[_type == "rating" && reader._ref == ^._id]),
      "reviews": count(*[_type == "review" && reader._ref == ^._id]),
      "emptyStill": count(*[_id == $empty])
    }`,
    {live: LIVE, empty: EMPTY},
  )
  console.log(JSON.stringify({before: keep, after: result}))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
