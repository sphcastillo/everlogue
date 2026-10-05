import {test} from 'node:test'
import assert from 'node:assert/strict'
import {loadForYouShelf, loadHomeShelfData} from '../src/lib/home-shelf-data'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return {promise, resolve}
}

test('public catalog starts before reader setup finishes; personal picks do not wait for the catalog', async () => {
  const reader = deferred<{readerId: string}>()
  const catalog = deferred<string[]>()
  const personalStarted = deferred<void>()
  const calls: string[] = []
  const result = loadHomeShelfData(
    () => { calls.push('reader'); return reader.promise },
    () => { calls.push('catalog'); return catalog.promise },
    async session => {
      calls.push(`personal:${session.readerId}`)
      personalStarted.resolve()
      return {books: ['personal-book'], hasLibrary: true}
    },
  )
  assert.deepEqual(calls, ['catalog', 'reader'])
  reader.resolve({readerId: 'authenticated-reader'})
  await personalStarted.promise
  assert.ok(calls.includes('personal:authenticated-reader'))
  catalog.resolve(['catalog-book'])
  assert.deepEqual(await result, {
    reader: {readerId: 'authenticated-reader'},
    picks: ['catalog-book'],
    books: ['personal-book'],
    hasLibrary: true,
  })
})

test('guests never run a personal query and each request loads fresh data', async () => {
  let catalogReads = 0
  const load = () => loadHomeShelfData(
    async () => null,
    async () => ++catalogReads,
    async () => { throw new Error('Guest must not query private shelves') },
  )
  assert.deepEqual(await load(), {picks: 1, reader: null, books: [], hasLibrary: false})
  assert.deepEqual(await load(), {picks: 2, reader: null, books: [], hasLibrary: false})
})

test('For You skips the candidate query when the library is empty or has no taste', async () => {
  const empty = await loadForYouShelf(
    async () => ({hasLibrary: false, taste: {genres: ['Mystery']}, excludeIds: ['x']}),
    async () => { throw new Error('Must not query candidates without a library') },
  )
  assert.deepEqual(empty, {books: [], hasLibrary: false})

  const noTaste = await loadForYouShelf(
    async () => ({hasLibrary: true, taste: {genres: [], authors: []}, excludeIds: []}),
    async () => { throw new Error('Must not query candidates without taste') },
  )
  assert.deepEqual(noTaste, {books: [], hasLibrary: true})
})

test('For You ranks parametrized candidates after a cheap taste fetch', async () => {
  let candidateParams: unknown
  const result = await loadForYouShelf(
    async () => ({
      hasLibrary: true,
      excludeIds: ['on-shelf'],
      taste: {genres: ['Mystery'], lovedGenres: ['Literary Fiction'], authors: ['Toni Morrison']},
    }),
    async (params) => {
      candidateParams = params
      return [
        {_id: 'popular', ratingStats: {count: 90}, genres: [{title: 'History'}]},
        {_id: 'loved', ratingStats: {count: 1}, genres: [{title: 'Literary Fiction'}]},
      ]
    },
  )
  assert.deepEqual(candidateParams, {
    excludeIds: ['on-shelf'],
    genres: ['Mystery'],
    authors: ['Toni Morrison'],
  })
  assert.equal(result.hasLibrary, true)
  assert.deepEqual(result.books.map((book) => book._id), ['loved', 'popular'])
})

test('failed reader setup is not silently treated as an empty personal library', async () => {
  const failure = new Error('Reader setup unavailable')
  await assert.rejects(loadHomeShelfData(
    async () => { throw failure },
    async () => ['catalog-book'],
    async () => { throw new Error('Must not run without reader identity') },
  ), error => error === failure)
})
