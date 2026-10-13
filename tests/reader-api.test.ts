import assert from 'node:assert/strict'
import {test} from 'node:test'
import {apiFixture, jsonRequest, reference} from './helpers/reader-api-fixture'

const get = (path: string) => new Request(`https://everlogue.test/api/reader/${path}`)
const shelfBody = (status: string | null) => ({book: {source: 'catalog', id: 'book'}, status})
const privateResponse = (response: Response, status = 200) => {
  assert.equal(response.status, status)
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0')
}

test('private reads use verified Clerk identity and actual ownership GROQ', async () => {
  const f = await apiFixture()
  const a = await f.profile.GET(get('profile'))
  privateResponse(a)
  assert.deepEqual(await a.json(), {profile: {displayName: 'A', spaceColor: null, avatarSrc: null, hasCustomAvatar: false, ratingCount: 0, reviewCount: 0, ratings: [], reviews: []}})
  const library = await f.library.GET(get('library'))
  privateResponse(library)
  const data = (await library.json()).library
  assert.equal(data.shelves.length, 4)
  assert.ok(data.shelves.every((s: {_id: string; entries: unknown[]}) => s._id.includes('reader-a') && s.entries.length === 0))
  assert.deepEqual(data.ratings, [])
  f.authenticate({isAuthenticated: true, userId: 'user_b'})
  const b = (await (await f.profile.GET(get('profile'))).json()).profile
  assert.equal(b.displayName, 'B')
  assert.equal(b.ratings[0].value, 2)
  assert.equal(b.reviews[0].body, 'B only')
  assert.equal(b.ratingCount, 1)
})

test('all endpoints reject guests before any private read or mutation', async () => {
  const f = await apiFixture()
  f.authenticate({isAuthenticated: false, userId: null})
  for (const response of [await f.profile.GET(get('profile')), await f.library.GET(get('library')), await f.shelf.PUT(jsonRequest('shelf-status', shelfBody('finished'))), await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value: 4}))]) {
    privateResponse(response, 401)
    assert.equal((await response.json()).code, 'unauthenticated')
  }
  assert.equal(f.calls.length, 0)
  assert.equal(f.invalidated.length, 0)
})

test('add, repeat, move and remove share web rules and preserve edition/history/custom shelves', async () => {
  const f = await apiFixture()
  const beforeB = structuredClone([...f.docs.values()].filter(d => d._id.endsWith('-b') || d._id.includes('reader-b')))
  privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', shelfBody('wantToRead'))))
  privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', shelfBody('wantToRead'))))
  assert.equal([...f.docs.values()].filter(d => d._type === 'shelfEntry' && JSON.stringify(d.shelf).includes('reader-a')).length, 1)
  const progress = f.docs.get('progress-reader-a-book')!
  progress.edition = reference('edition')
  progress.finishedAt = '2020-01-02'
  progress.readCount = 2
  progress.importSource = 'goodreads'
  // A migrated progress ID must remain authoritative.
  f.docs.delete(progress._id)
  progress._id = 'migrated-progress'
  f.docs.set(progress._id, progress)
  f.docs.set('custom-entry', {_id: 'custom-entry', _type: 'shelfEntry', book: reference('book'), shelf: reference('shelf-reader-a-custom'), addedAt: '2020-01-01'})
  privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', shelfBody('currentlyReading'))))
  assert.equal(f.docs.get('migrated-progress')?.status, 'currentlyReading')
  assert.equal(progress.finishedAt, '2020-01-02')
  assert.equal(progress.readCount, 2)
  assert.deepEqual(f.docs.get('shelfEntry-shelf-reader-a-currentlyReading-book')?.edition, reference('edition'))
  const library = (await (await f.library.GET(get('library'))).json()).library
  assert.equal(library.shelves.find((s: {kind: string}) => s.kind === 'currentlyReading').entries[0].editionId, 'edition')
  // Web actions use the same entry point and mutations.
  await f.web.saveShelfStatusAction({source: 'catalog', id: 'book'}, 'finished')
  assert.equal(progress.status, 'finished')
  privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', shelfBody(null))))
  assert.equal(f.docs.has('migrated-progress'), false)
  assert.ok(f.docs.has('custom-entry'))
  assert.deepEqual([...f.docs.values()].filter(d => d._id.endsWith('-b') || d._id.includes('reader-b')), beforeB)
  assert.ok(f.invalidated.includes('/my-shelves'))
})

test('ratings enforce status, half-stars, migrated IDs and isolation; removal is idempotent', async () => {
  const f = await apiFixture()
  privateResponse(await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value: 4.5})), 409)
  await f.shelf.PUT(jsonRequest('shelf-status', shelfBody('currentlyReading')))
  for (const value of [0, 5.5, 3.25, '4', undefined]) {
    privateResponse(await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value})), 400)
  }
  privateResponse(await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value: 4.5})))
  const rating = f.docs.get('rating-reader-a-book')!
  f.docs.delete(rating._id)
  rating._id = 'migrated-rating'
  f.docs.set(rating._id, rating)
  await f.web.saveRatingAction('book', 3.5)
  assert.equal(rating.value, 3.5)
  const profile = (await (await f.profile.GET(get('profile'))).json()).profile
  assert.equal(profile.ratings[0].value, 3.5, 'an API refetch sees the web action update')
  privateResponse(await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value: 5})))
  assert.equal(rating.value, 5)
  const library = (await (await f.library.GET(get('library'))).json()).library
  assert.deepEqual(library.ratings, [{bookId: 'book', value: 5}])
  assert.equal(f.docs.get('rating-b')?.value, 2)
  assert.equal((f.docs.get('book')?.ratingStats as {average: number}).average, 3.5)
  // Removing reading status must not silently delete a saved rating.
  await f.shelf.PUT(jsonRequest('shelf-status', shelfBody(null)))
  assert.equal(rating.value, 5)
  privateResponse(await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value: null})))
  privateResponse(await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value: null})))
  assert.equal(f.docs.has('migrated-rating'), false)
  assert.equal(f.docs.get('rating-b')?.value, 2)
})

test('rejects user/reader/shelf/document overrides and cannot use another readers IDs', async () => {
  const f = await apiFixture()
  const before = structuredClone([...f.docs.values()])
  for (const key of ['readerId', 'userId', 'clerkUserId', 'email', 'shelfId', 'entryId', 'ratingId']) {
    privateResponse(await f.profile.GET(get(`profile?${key}=reader-b`)), 400)
    privateResponse(await f.library.GET(get(`library?${key}=reader-b`)), 400)
    privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', {...shelfBody('finished'), [key]: 'reader-b'})), 400)
    privateResponse(await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value: null, [key]: 'rating-b'})), 400)
  }
  privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', {book: {...shelfBody(null).book, readerId: 'reader-b'}, status: null})), 400)
  for (const id of ['entry-b', 'rating-b', 'shelf-reader-b-finished']) {
    privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', {book: {source: 'catalog', id}, status: null})), 404)
    privateResponse(await f.rating.PUT(jsonRequest('rating', {bookId: id, value: null})), 404)
  }
  assert.deepEqual([...f.docs.values()], before)
})

test('Google Books placement uses the same resolver/edition selection as web and returns catalog identity', async () => {
  const f = await apiFixture()
  const response = await f.shelf.PUT(jsonRequest('shelf-status', {book: {source: 'googleBooks', id: 'volume'}, status: 'wantToRead'}))
  privateResponse(response)
  assert.deepEqual(await response.json(), {ok: true, bookId: 'book', status: 'wantToRead'})
  assert.deepEqual(f.docs.get('progress-reader-a-book')?.edition, reference('edition'))
  assert.deepEqual(f.googleCalls, ['volume'])
  privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', {book: {source: 'googleBooks', id: 'missing'}, status: 'wantToRead'})), 404)
})

test('Google Books removal does not import a missing work; adding it twice reuses its generated identity', async () => {
  const f = await apiFixture()
  const book = {source: 'googleBooks', id: 'new-volume'}
  const removed = await f.shelf.PUT(jsonRequest('shelf-status', {book, status: null}))
  privateResponse(removed)
  assert.deepEqual(await removed.json(), {ok: true, bookId: null, status: null})
  const added = await f.shelf.PUT(jsonRequest('shelf-status', {book, status: 'finished'}))
  privateResponse(added)
  const {bookId} = await added.json()
  assert.match(bookId, /^generated-/)
  const repeated = await f.shelf.PUT(jsonRequest('shelf-status', {book, status: 'finished'}))
  privateResponse(repeated)
  assert.equal((await repeated.json()).bookId, bookId)
  assert.equal([...f.docs.values()].filter(d => d._type === 'book' && d.googleBooksId === 'new-volume').length, 1)
})

test('invalid JSON, null/array bodies, invalid statuses, origins and large bodies fail safely', async () => {
  const f = await apiFixture()
  for (const body of [null, [], {}, shelfBody('custom'), shelfBody('read'), {book: {source: 'catalog', id: ''}, status: 'finished'}]) {
    privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', body)), 400)
  }
  privateResponse(await f.shelf.PUT(new Request(get('shelf-status'), {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: '{'})), 400)
  privateResponse(await f.shelf.PUT(new Request(get('shelf-status'), {method: 'PUT', body: '{}'})), 415)
  privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', shelfBody('finished'), {Origin: 'https://other.test'})), 403)
  privateResponse(await f.shelf.PUT(jsonRequest('shelf-status', {padding: 'é'.repeat(5000)})), 413)
  assert.equal(f.invalidated.length, 0)
})

test('storage errors are sanitized and never cached', async () => {
  const f = await apiFixture()
  // Fail after the authenticated reader lookup, exercising the route error boundary.
  const fetch = f.client.fetch
  f.client.fetch = async (query, params, options) => {
    if (query.includes('"shelves":')) throw new Error('private upstream token=must-not-leak')
    return fetch(query, params, options)
  }
  const response = await f.library.GET(get('library'))
  privateResponse(response, 503)
  assert.deepEqual(await response.json(), {error: 'Reader service unavailable. Please try again.', code: 'service_unavailable'})
})
