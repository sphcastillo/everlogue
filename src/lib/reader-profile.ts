import type {SanityClient} from '@sanity/client'
import {urlFor} from '@/sanity/image'
import {slugify, stableId} from './validation'
import {ReaderProfilePendingError, retryReaderSetup} from './reader-setup-retry'

export type ReaderAvatar = {
  asset?: {_id?: string; _ref?: string; url?: string | null} | null
  alt?: string | null
  hotspot?: unknown
  crop?: unknown
} | null

export type ReaderProfile = {
  _id: string
  clerkUserId: string
  displayName: string
  email?: string | null
  spaceColor?: string | null
  avatar?: ReaderAvatar
  avatarUrl?: string | null
  systemShelves?: SystemShelf[]
}

type SystemShelf = {_id: string; name?: string; slug?: {current?: string}}

const systemShelvesProjection = `*[_type == "shelf" && owner._ref == ^._id && kind in ["wantToRead", "currentlyReading", "finished"] && !(_id in path("drafts.**"))]{_id, name, slug}`

export type ClerkIdentity = {
  id: string
  firstName: string | null
  username: string | null
  imageUrl: string
  primaryEmailAddress?: {emailAddress?: string | null} | null
  emailAddresses?: Array<{emailAddress?: string | null}> | null
}

function clerkEmail(user: ClerkIdentity) {
  return user.primaryEmailAddress?.emailAddress?.trim()
    || user.emailAddresses?.find((address) => address.emailAddress?.trim())?.emailAddress?.trim()
    || undefined
}

export const PROFILE_QUERY = `*[_type == "readerProfile" && clerkUserId == $clerkUserId && !(_id in path("drafts.**"))] | order(_createdAt asc)[0]{_id, clerkUserId, displayName, email, spaceColor, avatarUrl, avatar{asset->{_id, url}, alt, hotspot, crop}, "systemShelves": ${systemShelvesProjection}}`

/** Uploaded Sanity image only. Clerk avatars are read live from the session. */
export function profileAvatarSrc(profile?: Pick<ReaderProfile, 'avatar' | 'avatarUrl'> | null) {
  const asset = profile?.avatar?.asset
  const ref = asset?._ref || asset?._id
  if (!ref) return null
  return urlFor({
    _type: 'image',
    asset: {_ref: ref},
    hotspot: profile?.avatar?.hotspot,
    crop: profile?.avatar?.crop,
  } as Parameters<typeof urlFor>[0]).width(96).height(96).fit('crop').auto('format').url()
}

// An internal uniqueness guard, not the profile ID. Sanity generates profile IDs.
export const identityGuardId = (id: string) => `clerkIdentity.${id}`

export async function syncReaderProfile(client: SanityClient, user: ClerkIdentity) {
  const findProfile = () => client.fetch<ReaderProfile | null>(
    // no-store disables persistent caching, but not React GET deduplication.
    // A fresh signal opts out so a retry cannot replay the pre-creation null.
    PROFILE_QUERY, {clerkUserId: user.id}, {cache: 'no-store', signal: new AbortController().signal},
  )
  const email = clerkEmail(user)
  const fields = {
    displayName: user.firstName || user.username || 'Reader',
    avatarUrl: user.imageUrl,
    ...(email ? {email} : {}),
  }
  let profile = await findProfile()
  if (!profile) {
    try {
      // The guard and generated profile commit together; competing creators fail
      // before adding a second profile. Use the returned document directly;
      // resolving it through another query can replay the earlier null result.
      const created = await client.transaction()
        .create({_id: identityGuardId(user.id), _type: 'clerkIdentity', clerkUserId: user.id})
        .create({_type: 'readerProfile', clerkUserId: user.id, ...fields, profileVisibility: 'private'})
        .commit<ReaderProfile>({visibility: 'sync', returnDocuments: true, returnFirst: false})
      profile = created.find(document => document._type === 'readerProfile' && document.clerkUserId === user.id) ?? null
    } catch (error) {
      if (!(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409)) {
        throw error
      }
    }
    // A losing creator may see the guard conflict before the winner's profile
    // reaches the query index. Wait for visibility instead of failing sign-in.
    if (!profile) profile = await retryReaderSetup(async () => {
      const resolved = await findProfile()
      if (!resolved) throw new ReaderProfilePendingError('Unable to resolve the Clerk reader profile.')
      return resolved
    })
  }
  // Patch only identity fields; preserve shelves, preferences, bio and visibility.
  await client.patch(profile._id).set(fields).commit()
  await ensureSystemShelves(client, profile._id, profile.systemShelves)
  return {...profile, ...fields}
}

export async function ensureSystemShelves(client: SanityClient, readerId: string, snapshot?: SystemShelf[]) {
  const shelves = [
    {kind: 'wantToRead', name: 'Want to Read'},
    {kind: 'currentlyReading', name: 'Currently Reading'},
    {kind: 'finished', name: 'Read'},
  ] as const
  // The normal reader lookup includes this snapshot in its fresh profile query,
  // so healthy accounts need no additional reads or writes.
  const existing = snapshot ?? await client.fetch<SystemShelf[]>(
    `*[_type == "shelf" && owner._ref == $readerId && !(_id in path("drafts.**"))]{_id, name, slug}`,
    {readerId}, {cache: 'no-store'},
  )
  const tx = client.transaction()
  let changed = false
  for (const shelf of shelves) {
    const id = stableId(['shelf', readerId, shelf.kind])
    const current = existing.find((item) => item._id === id)
    const slug = {_type: 'slug', current: slugify(shelf.name)}
    if (!current) {
      tx.createIfNotExists({
        _id: id,
        _type: 'shelf',
        owner: {_type: 'reference', _ref: readerId},
        name: shelf.name,
        slug,
        kind: shelf.kind,
        visibility: 'private',
      })
      changed = true
    } else if (current.name !== shelf.name || current.slug?.current !== slug.current) {
      tx.patch(id, {set: {name: shelf.name, slug}})
      changed = true
    }
  }
  // Missing shelves remain safe under concurrent sign-ins. Repair all changes
  // together and make them visible before the following library query.
  if (changed) await tx.commit({visibility: 'sync'})
}
