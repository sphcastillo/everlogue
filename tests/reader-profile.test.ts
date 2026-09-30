import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SanityClient} from '@sanity/client'
import {ensureSystemShelves, profileAvatarSrc, syncReaderProfile} from '../src/lib/reader-profile'

type Document = Record<string, unknown> & {_id: string}
const user = {id: 'user_test', firstName: 'Avery', username: null, imageUrl: 'https://example.com/avatar.png'}

function database(initial: Document[] = []) {
  const docs = new Map(initial.map((doc) => [doc._id, {...doc}]))
  let sequence = 0
  let failShelves = false
  const calls = {fetch: 0, shelfCommits: 0}
  const shelvesFor = (readerId?: string) => [...docs.values()].filter((doc) => doc._type === 'shelf' && (doc.owner as {_ref?: string})?._ref === readerId).map((doc) => ({...doc}))
  const client = {
    async fetch(_query: string, params: {clerkUserId?: string; readerId?: string}) {
      calls.fetch++
      if (params.readerId) return shelvesFor(params.readerId)
      const doc = [...docs.values()].find((doc) => doc._type === 'readerProfile' && doc.clerkUserId === params.clerkUserId)
      return doc ? {...doc, systemShelves: shelvesFor(doc._id)} : null
    },
    transaction() {
      const pending: Document[] = []
      const missing: Document[] = []
      const patches: {id: string; set: object}[] = []
      const tx = {
        create(doc: Record<string, unknown>) {
          pending.push({...doc, _id: String(doc._id || `generated-${++sequence}`)})
          return tx
        },
        createIfNotExists(doc: Document) { missing.push(doc); return tx },
        patch(id: string, update: {set: object}) { patches.push({id, set: update.set}); return tx },
        async commit() {
          if (missing.length || patches.length) {
            calls.shelfCommits++
            if (failShelves) throw new Error('Sanity unavailable')
          }
          if (pending.some((doc) => docs.has(doc._id))) throw Object.assign(new Error('Conflict'), {statusCode: 409})
          for (const doc of pending) docs.set(doc._id, doc)
          for (const doc of missing) if (!docs.has(doc._id)) docs.set(doc._id, doc)
          for (const patch of patches) docs.set(patch.id, {...docs.get(patch.id)!, ...patch.set})
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
  return {client, docs, calls, shelvesFor, setFailShelves: (value: boolean) => { failShelves = value }}
}

test('healthy shelf snapshots require no extra requests on repeat visits', async () => {
  const db = database()
  await ensureSystemShelves(db.client, 'reader', [])
  assert.equal(db.calls.shelfCommits, 1)
  for (let visit = 0; visit < 3; visit++) {
    await ensureSystemShelves(db.client, 'reader', db.shelvesFor('reader'))
  }
  assert.equal(db.calls.fetch, 0)
  assert.equal(db.calls.shelfCommits, 1)
})

test('repairs missing shelves and old labels in one transaction, preserving entries and custom shelves', async () => {
  const db = database()
  await ensureSystemShelves(db.client, 'reader', [])
  db.docs.delete('shelf-reader-wantToRead')
  const finished = db.docs.get('shelf-reader-finished')!
  finished.name = 'Finished'
  finished.slug = {_type: 'slug', current: 'finished'}
  finished.visibility = 'public'
  db.docs.set('custom', {_id: 'custom', _type: 'shelf', owner: {_ref: 'reader'}, name: 'Favorites', kind: 'custom'})
  db.docs.set('entry', {_id: 'entry', _type: 'shelfEntry', shelf: {_ref: finished._id}, book: {_ref: 'book'}})
  const entry = db.docs.get('entry')
  await ensureSystemShelves(db.client, 'reader', db.shelvesFor('reader'))
  assert.equal(db.calls.shelfCommits, 2)
  assert.equal(db.docs.get(finished._id)?.name, 'Read')
  assert.equal(db.docs.get(finished._id)?.visibility, 'public')
  assert.ok(db.docs.has('shelf-reader-wantToRead'))
  assert.equal(db.docs.get('custom')?.name, 'Favorites')
  assert.equal(db.docs.get('entry'), entry)
  await ensureSystemShelves(db.client, 'reader', db.shelvesFor('reader'))
  assert.equal(db.calls.shelfCommits, 2)
})

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
