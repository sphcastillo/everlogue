import {test} from 'node:test'
import assert from 'node:assert/strict'
import {loadHomeShelfData} from '../src/lib/home-shelf-data'

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
      return ['personal-book']
    },
  )
  assert.deepEqual(calls, ['catalog', 'reader'])
  reader.resolve({readerId: 'authenticated-reader'})
  await personalStarted.promise
  assert.ok(calls.includes('personal:authenticated-reader'))
  catalog.resolve(['catalog-book'])
  assert.deepEqual(await result, {reader: {readerId: 'authenticated-reader'}, picks: ['catalog-book'], books: ['personal-book']})
})

test('guests never run a personal query and each request loads fresh data', async () => {
  let catalogReads = 0
  const load = () => loadHomeShelfData(
    async () => null,
    async () => ++catalogReads,
    async () => { throw new Error('Guest must not query private shelves') },
  )
  assert.deepEqual(await load(), {picks: 1, reader: null, books: []})
  assert.deepEqual(await load(), {picks: 2, reader: null, books: []})
})

test('failed reader setup is not silently treated as an empty personal library', async () => {
  const failure = new Error('Reader setup unavailable')
  await assert.rejects(loadHomeShelfData(
    async () => { throw failure },
    async () => ['catalog-book'],
    async () => { throw new Error('Must not run without reader identity') },
  ), error => error === failure)
})
