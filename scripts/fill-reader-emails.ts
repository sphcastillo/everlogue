import {config} from 'dotenv'
import {createClient} from '@sanity/client'

config({path: ['.env.local', '.env'], quiet: true})

const secret = process.env.CLERK_SECRET_KEY
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const token = process.env.SANITY_API_WRITE_TOKEN
if (!secret || !projectId || !token) throw new Error('Missing Clerk or Sanity credentials')

const DATASETS = ['development', 'production'] as const

/** Known Clerk ids from this project, used when the local key is a different instance. */
const KNOWN_EMAILS: Record<string, string> = {
  user_3KNyZDOJ4Ls7hWQZPKmFmSRJ4co: 'thesophiacastillo@gmail.com',
  user_3JdEvctuHQtc7ZQFjjvCR420cHm: 'sphcastillo@gmail.com',
}

type ClerkUser = {
  id?: string
  primary_email_address_id?: string | null
  email_addresses?: Array<{id?: string; email_address?: string}>
  errors?: unknown
}

const emailCache = new Map<string, string | null>()

async function clerkEmail(userId: string) {
  if (userId.startsWith('demo-')) return null
  if (emailCache.has(userId)) return emailCache.get(userId) ?? null
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: {Authorization: `Bearer ${secret}`},
  })
  if (res.status === 404) {
    const known = KNOWN_EMAILS[userId] ?? null
    emailCache.set(userId, known)
    return known
  }
  if (!res.ok) throw new Error(`Clerk ${userId}: ${res.status}`)
  const user = (await res.json()) as ClerkUser
  const email =
    user.email_addresses?.find((item) => item.id === user.primary_email_address_id)?.email_address
    || user.email_addresses?.[0]?.email_address
    || null
  emailCache.set(userId, email)
  return email
}

async function fillDataset(dataset: (typeof DATASETS)[number]) {
  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2026-09-01',
    useCdn: false,
    perspective: 'raw',
  })
  const profiles = await client.fetch<Array<{_id: string; clerkUserId: string; email?: string | null}>>(
    `*[_type == "readerProfile" && defined(clerkUserId)]{_id, clerkUserId, email}`,
  )
  const results: Array<{id: string; clerkUserId: string; email: string | null; skipped?: boolean}> = []
  for (const profile of profiles) {
    const email = await clerkEmail(profile.clerkUserId)
    if (!email) {
      results.push({id: profile._id, clerkUserId: profile.clerkUserId, email: null})
      continue
    }
    if (profile.email === email) {
      results.push({id: profile._id, clerkUserId: profile.clerkUserId, email, skipped: true})
      continue
    }
    await client.patch(profile._id).set({email}).commit({visibility: 'sync'})
    results.push({id: profile._id, clerkUserId: profile.clerkUserId, email})
  }
  return results
}

async function main() {
  const development = await fillDataset('development')
  const production = await fillDataset('production')
  console.log(JSON.stringify({development, production}, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
