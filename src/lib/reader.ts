import 'server-only'
import {auth, currentUser} from '@clerk/nextjs/server'
import {privateClient, writeClient} from '@/sanity/client'
import {cache} from 'react'
import {retryReaderSetup} from './reader-setup-retry'
import {ensureSystemShelves, PROFILE_QUERY, profileAvatarSrc, syncReaderProfile, type ReaderProfile} from './reader-profile'

export type ReaderSession = {
  readerId: string
  clerkUserId: string
  displayName: string
  spaceColor?: string | null
  avatarSrc?: string | null
  hasCustomAvatar?: boolean
}

export const getOptionalReader = cache(async (): Promise<ReaderSession | null> => {
  if (!process.env.CLERK_SECRET_KEY) return null
  const {isAuthenticated, userId} = await auth()
  if (!isAuthenticated || !userId) return null
  try {
    return await retryReaderSetup(() => getOrCreateReader(userId))
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
    PROFILE_QUERY, {clerkUserId}, {cache: 'no-store', signal: new AbortController().signal},
  )
  if (existing?._id) {
    let profile = existing
    if (!existing.email) {
      const user = await currentUser()
      if (user && user.id === clerkUserId) profile = await syncReaderProfile(writeClient(), user)
    }
    await ensureSystemShelves(writeClient(), profile._id, profile.systemShelves)
    return {
      readerId: profile._id,
      clerkUserId,
      displayName: profile.displayName || 'Reader',
      spaceColor: profile.spaceColor,
      avatarSrc: profileAvatarSrc(profile),
      hasCustomAvatar: Boolean(profile.avatar?.asset?._id || profile.avatar?.asset?._ref),
    }
  }

  const user = await currentUser()
  if (!user || user.id !== clerkUserId) throw new Error('Unable to verify the signed-in reader.')
  const profile = await syncReaderProfile(writeClient(), user)
  return {
    readerId: profile._id,
    clerkUserId,
    displayName: profile.displayName,
    spaceColor: profile.spaceColor,
    avatarSrc: profileAvatarSrc(profile),
    hasCustomAvatar: Boolean(profile.avatar?.asset?._id || profile.avatar?.asset?._ref),
  }
}

export function privateHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
  }
}
