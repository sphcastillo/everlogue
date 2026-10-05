import {config} from 'dotenv'
import {createClient, type SanityClient} from '@sanity/client'

config({path: ['.env.local', '.env'], quiet: true})

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const token = process.env.SANITY_API_WRITE_TOKEN
if (!projectId || !token) throw new Error('Missing Sanity project or write token')

const PROFILE = 'OgAUDuWX5jwqflSvkipbFM'
const KEEP = 'ngqA6mE9gKvtS1xUUXRvoX'
const DEV_CLERK = 'user_3JdEvctuHQtc7ZQFjjvCR420cHm'
const OLD_CLERK = 'user_3KF5X5pugW4mavCo0Mh1qxicYba'
const STRIP = new Set(['_rev', '_updatedAt', '_originalId'])

const source = createClient({
  projectId, dataset: 'production', token, apiVersion: '2026-09-01', useCdn: false, perspective: 'raw',
})
const dest = createClient({
  projectId, dataset: 'development', token, apiVersion: '2026-09-01', useCdn: false, perspective: 'raw',
})

function clean(doc: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(doc).filter(([key]) => !STRIP.has(key)))
}

async function fetchAll(client: SanityClient, query: string, params: Record<string, unknown> = {}) {
  return client.fetch<Record<string, unknown>[]>(query, params, {cache: 'no-store'})
}

async function write(client: SanityClient, docs: Record<string, unknown>[]) {
  for (let index = 0; index < docs.length; index += 40) {
    let tx = client.transaction()
    for (const doc of docs.slice(index, index + 40)) {
      if (!doc._id || !doc._type) throw new Error('Document missing _id or _type')
      tx = tx.createOrReplace(clean(doc) as {_id: string; _type: string})
    }
    await tx.commit({visibility: 'sync'})
  }
}

async function remove(client: SanityClient, ids: string[]) {
  for (let index = 0; index < ids.length; index += 40) {
    let tx = client.transaction()
    for (const id of ids.slice(index, index + 40)) {
      if (id === KEEP) throw new Error('Refusing to delete the production Sophia profile')
      tx = tx.delete(id)
    }
    await tx.commit({visibility: 'sync'})
  }
}

async function main() {
  const existing = await dest.fetch<string | null>(
    `*[_type == "readerProfile" && clerkUserId == $clerk][0]._id`,
    {clerk: DEV_CLERK},
    {cache: 'no-store'},
  )
  if (existing && existing !== PROFILE) {
    throw new Error(`Development already has a reader for the local Clerk user: ${existing}`)
  }

  const owned = await fetchAll(source, `{
    "profile": *[_id == $profile][0],
    "guard": *[_id == $guard][0],
    "shelves": *[_type == "shelf" && owner._ref == $profile],
    "entries": *[_type == "shelfEntry" && shelf->owner._ref == $profile],
    "ratings": *[_type == "rating" && reader._ref == $profile],
    "reviews": *[_type == "review" && reader._ref == $profile],
    "progress": *[_type == "readingProgress" && reader._ref == $profile],
    "companion": *[_type == "companionConversation" && reader._ref == $profile],
    "usage": *[_type == "companionUsage" && reader._ref == $profile]
  }`, {profile: PROFILE, guard: `clerkIdentity.${OLD_CLERK}`}) as unknown as {
    profile: Record<string, unknown> | null
    guard: Record<string, unknown> | null
    shelves: Record<string, unknown>[]
    entries: Record<string, unknown>[]
    ratings: Record<string, unknown>[]
    reviews: Record<string, unknown>[]
    progress: Record<string, unknown>[]
    companion: Record<string, unknown>[]
    usage: Record<string, unknown>[]
  }

  if (!owned.profile) throw new Error('Oct 4 Sophia profile was not found in production')
  if (owned.profile._id === KEEP) throw new Error('Profile id mismatch')

  const bookIds = [...new Set([
    ...owned.entries.map((doc) => (doc.book as {_ref?: string} | undefined)?._ref),
    ...owned.ratings.map((doc) => (doc.book as {_ref?: string} | undefined)?._ref),
    ...owned.progress.map((doc) => (doc.book as {_ref?: string} | undefined)?._ref),
  ].filter((id): id is string => Boolean(id)))]
  const editionIds = [...new Set(
    owned.progress.map((doc) => (doc.edition as {_ref?: string} | undefined)?._ref).filter((id): id is string => Boolean(id)),
  )]

  const books = bookIds.length
    ? await fetchAll(source, `*[_id in $ids]`, {ids: bookIds})
    : []
  const editions = editionIds.length
    ? await fetchAll(source, `*[_id in $ids]`, {ids: editionIds})
    : []

  const readerDocs = [
    {...owned.profile, clerkUserId: DEV_CLERK},
    {_id: `clerkIdentity.${DEV_CLERK}`, _type: 'clerkIdentity', clerkUserId: DEV_CLERK},
    ...owned.shelves,
    ...owned.entries,
    ...owned.ratings,
    ...owned.reviews,
    ...owned.progress,
    ...owned.companion,
    ...owned.usage,
  ]
  const catalogDocs = [...books, ...editions]

  console.log(JSON.stringify({
    copying: {
      readerDocs: readerDocs.length,
      books: books.length,
      editions: editions.length,
      ratings: owned.ratings.length,
      shelfEntries: owned.entries.length,
      progress: owned.progress.length,
    },
  }))

  await write(dest, catalogDocs)
  await write(dest, readerDocs)

  const deleteIds = [
    ...owned.entries,
    ...owned.ratings,
    ...owned.reviews,
    ...owned.progress,
    ...owned.companion,
    ...owned.usage,
    ...owned.shelves,
    owned.profile,
    owned.guard,
  ].flatMap((doc) => (doc?._id ? [String(doc._id)] : []))

  await remove(source, deleteIds)

  const prodLeft = await source.fetch<number>(
    `count(*[_id == $profile || clerkUserId == $old])`,
    {profile: PROFILE, old: OLD_CLERK},
    {cache: 'no-store'},
  )
  const prodKeep = await source.fetch<{clerkUserId?: string; ratings?: number} | null>(
    `*[_id == $keep][0]{clerkUserId, "ratings": count(*[_type == "rating" && reader._ref == ^._id])}`,
    {keep: KEEP},
    {cache: 'no-store'},
  )
  const destNow = await dest.fetch<{clerkUserId?: string; ratings?: number} | null>(
    `*[_id == $profile][0]{clerkUserId, "ratings": count(*[_type == "rating" && reader._ref == ^._id])}`,
    {profile: PROFILE},
    {cache: 'no-store'},
  )

  console.log(JSON.stringify({prodLeft, prodKeep, destNow}))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
