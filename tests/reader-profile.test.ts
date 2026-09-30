import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SanityClient} from '@sanity/client'
import {profileAvatarSrc, syncReaderProfile} from '../src/lib/reader-profile'

type Document = Record<string, unknown> & {_id: string}
const user = {id: 'user_test', firstName: 'Avery', username: null, imageUrl: 'https://example.com/avatar.png'}

function database(initial: Document[] = []) {
  const docs = new Map(initial.map((doc) => [doc._id, {...doc}]))
  let sequence = 0
  let failShelves = false
  const client = {
    async fetch(_query: string, params: {clerkUserId: string}) {
      const doc = [...docs.values()].find((doc) => doc._type === 'readerProfile' && doc.clerkUserId === params.clerkUserId)
      return doc ? {...doc} : null
    },
    transaction() {
      const pending: Document[] = []
      const tx = {
        create(doc: Record<string, unknown>) {
          pending.push({...doc, _id: String(doc._id || `generated-${++sequence}`)})
          return tx
        },
        async commit() {
          if (pending.some((doc) => docs.has(doc._id))) throw Object.assign(new Error('Conflict'), {statusCode: 409})
          for (const doc of pending) docs.set(doc._id, doc)
        },
      }
      return tx
    },
    patch(id: string) {
      return {set: (fields: object) => ({commit: async () => {
        docs.set(id, {...docs.get(id)!, ...fields})
      }})}
    },
    async createIfNotExists(doc: Document) {
      if (failShelves) throw new Error('Sanity unavailable')
      if (!docs.has(doc._id)) docs.set(doc._id, doc)
    },
  } as unknown as SanityClient
  return {client, docs, setFailShelves: (value: boolean) => { failShelves = value }}
}

test('concurrent signup and signed-in requests share one profile and three shelves', async () => {
  const {client, docs} = database()
  const results = await Promise.all([syncReaderProfile(client, user), syncReaderProfile(client, user)])
  assert.equal(results[0]._id, results[1]._id)
  assert.equal([...docs.values()].filter((doc) => doc._type === 'readerProfile').length, 1)
  const shelves = [...docs.values()].filter((doc) => doc._type === 'shelf')
  assert.equal(shelves.length, 3)
  assert.ok(shelves.every((doc) => (doc.owner as {_ref: string})._ref === results[0]._id))
})

test('updates reuse an existing profile and preserve reader preferences', async () => {
  const {client, docs} = database([{
    _id: 'existing-profile', _type: 'readerProfile', clerkUserId: user.id,
    displayName: 'Old name', bio: 'My bio', spaceColor: 'mint', profileVisibility: 'publicName',
    avatar: 'keep-me',
  }])
  await syncReaderProfile(client, user)
  await syncReaderProfile(client, {...user, firstName: 'New name'})
  assert.equal(docs.get('existing-profile')?.displayName, 'New name')
  assert.equal(docs.get('existing-profile')?.bio, 'My bio')
  assert.equal(docs.get('existing-profile')?.spaceColor, 'mint')
  assert.equal(docs.get('existing-profile')?.profileVisibility, 'publicName')
  assert.equal(docs.get('existing-profile')?.avatar, 'keep-me')
  assert.equal([...docs.values()].filter((doc) => doc._type === 'readerProfile').length, 1)
})

test('retry repairs shelves after a partial failure without another profile', async () => {
  const db = database()
  db.setFailShelves(true)
  await assert.rejects(syncReaderProfile(db.client, user), /Sanity unavailable/)
  db.setFailShelves(false)
  await syncReaderProfile(db.client, user)
  assert.equal([...db.docs.values()].filter((doc) => doc._type === 'readerProfile').length, 1)
  assert.equal([...db.docs.values()].filter((doc) => doc._type === 'shelf').length, 3)
})

test('unnamed accounts use a neutral display name', async () => {
  const {client} = database()
  const profile = await syncReaderProfile(client, {...user, firstName: null})
  assert.equal(profile.displayName, 'Reader')
})

test('header avatars prefer an uploaded image over the Clerk URL', () => {
  assert.equal(profileAvatarSrc({avatarUrl: 'https://example.com/avatar.png'}), 'https://example.com/avatar.png')
  const src = profileAvatarSrc({
    avatar: {asset: {_id: 'image-abc123-200x200-jpg'}},
    avatarUrl: 'https://example.com/avatar.png',
  })
  assert.match(src || '', /cdn\.sanity\.io/)
  assert.doesNotMatch(src || '', /example\.com/)
})
