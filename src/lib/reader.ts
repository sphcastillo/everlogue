import 'server-only'
import {auth, currentUser} from '@clerk/nextjs/server'
import {privateClient, writeClient} from '@/sanity/client'
import {cache} from 'react'
import {ensureSystemShelves, PROFILE_QUERY, syncReaderProfile, type ReaderProfile} from './reader-profile'

export type ReaderSession = {
  readerId: string
  clerkUserId: string
  displayName: string
  spaceColor?: string | null
}

export const getOptionalReader = cache(async (): Promise<ReaderSession | null> => {
  if (!process.env.CLERK_SECRET_KEY) return null
  const {userId} = await auth()
  if (!userId) return null
  try {
    return await getOrCreateReader(userId)
  } catch (error) {
    console.error('Unable to load the Sanity reader profile:', error)
    throw error
  }
})

export async function requireReader(): Promise<ReaderSession> {
  const reader = await getOptionalReader()
  if (!reader) {
    throw new Error('Sign in to continue.')
  }
  return reader
}

async function getOrCreateReader(clerkUserId: string): Promise<ReaderSession> {
  const existing = await privateClient.fetch<ReaderProfile | null>(
    PROFILE_QUERY, {clerkUserId}, {cache: 'no-store'},
  )
  if (existing?._id) {
    await ensureSystemShelves(writeClient(), existing._id)
    return {
      readerId: existing._id,
      clerkUserId,
      displayName: existing.displayName || 'Reader',
      spaceColor: existing.spaceColor,
    }
  }

  const user = await currentUser()
  if (!user || user.id !== clerkUserId) throw new Error('Unable to verify the signed-in reader.')
  const profile = await syncReaderProfile(writeClient(), user)
  return {readerId: profile._id, clerkUserId, displayName: profile.displayName, spaceColor: profile.spaceColor}
}

export function privateHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
  }
}
