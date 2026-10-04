import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SanityClient} from '@sanity/client'
import {
  catalogImportFailureId,
  reportCatalogImportFailure,
  resolveCatalogImportFailure,
} from '../src/lib/catalog-import-failure'
import type {GoodreadsBook} from '../src/lib/goodreads-csv'

const book: GoodreadsBook = {
  row: 4,
  title: 'Failed Title',
  author: 'Failed Author',
  status: 'finished',
  rating: 4.5,
  addedAt: '2020-02-02',
  finishedAt: '2020-03-03',
  readCount: 1,
}

function database() {
  const docs = new Map<string, Record<string, unknown>>()
  const client = {
    async createIfNotExists(doc: {_id: string}) {
      if (!docs.has(doc._id)) docs.set(doc._id, {...doc})
      return docs.get(doc._id)
    },
    patch(id: string) {
      const ops = {
        set(fields: object) {
          const current = docs.get(id)
          if (current) docs.set(id, {...current, ...fields})
          return ops
        },
        inc(fields: Record<string, number>) {
          const current = docs.get(id)
          if (current) {
            for (const [key, amount] of Object.entries(fields)) {
              current[key] = Number(current[key] || 0) + amount
            }
          }
          return ops
        },
        unset(keys: string[]) {
          const current = docs.get(id)
          if (current) for (const key of keys) delete current[key]
          return ops
        },
        async commit() {
          if (!docs.has(id)) throw Object.assign(new Error('Not found'), {statusCode: 404})
          return docs.get(id)
        },
      }
      return ops
    },
  } as unknown as SanityClient
  return {client, docs}
}

test('failed imports are stored with the reader and book details', async () => {
  const {client, docs} = database()
  await reportCatalogImportFailure(
    client,
    {readerId: 'reader-1', displayName: 'Ada'},
    book,
    new Error('Network failure'),
  )
  const doc = docs.get(catalogImportFailureId('reader-1', book))!
  assert.equal(doc._type, 'catalogImportFailure')
  assert.equal(doc.title, 'Failed Title')
  assert.equal(doc.author, 'Failed Author')
  assert.equal(doc.readerName, 'Ada')
  assert.equal((doc.reader as {_ref: string})._ref, 'reader-1')
  assert.equal(doc.rating, 4.5)
  assert.equal(doc.shelfStatus, 'finished')
  assert.equal(doc.retryCount, 1)
  assert.equal(doc.resolvedAt, undefined)
})

test('a successful retry marks the recorded failure resolved', async () => {
  const {client, docs} = database()
  await reportCatalogImportFailure(client, {readerId: 'reader-1', displayName: 'Ada'}, book, new Error('fail'))
  await resolveCatalogImportFailure(client, 'reader-1', book)
  assert.ok(docs.get(catalogImportFailureId('reader-1', book))?.resolvedAt)
})
