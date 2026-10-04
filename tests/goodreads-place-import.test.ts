import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SanityClient} from '@sanity/client'
import {placePendingGoodreadsImports} from '../src/lib/goodreads-place-import'

type Doc = Record<string, unknown> & {_id: string}
const ref = (value: unknown) => (value as {_ref?: string} | undefined)?._ref

function database(initial: Doc[] = []) {
  const docs = new Map(initial.map((doc) => [doc._id, {...doc}]))
  const client = {
    async fetch(query: string, params: Record<string, string>) {
      const all = [...docs.values()]
      if (query.includes('pendingImportPlacements')) return all.find((doc) => doc._id === params.id) || null
      if (query.includes('_type == "shelfEntry"')) {
        return all.some((doc) => doc._type === 'shelfEntry' && ref(doc.book) === params.bookId)
      }
      if (query.includes('_type == "rating"')) {
        return all.some((doc) => doc._type === 'rating' && ref(doc.reader) === params.readerId && ref(doc.book) === params.bookId)
      }
      if (query.includes('_type == "catalogImportFailure"')) {
        return all
          .filter((doc) => doc._type === 'catalogImportFailure' && ref(doc.reader) === params.readerId && ref(doc.book) === params.bookId)
          .map((doc) => doc._id)
      }
      return null
    },
    async createIfNotExists(doc: Doc) {
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
    transaction() {
      const pending: Doc[] = []
      const tx = {
        createIfNotExists(doc: Doc) {
          pending.push(doc)
          return tx
        },
        async commit() {
          for (const doc of pending) if (!docs.has(doc._id)) docs.set(doc._id, {...doc})
        },
      }
      return tx
    },
  } as unknown as SanityClient
  return {client, docs}
}

test('publishing a failed import places the book on the waiting reader’s shelf', async () => {
  const {client, docs} = database([
    {
      _id: 'book-1',
      _type: 'book',
      title: 'A Book',
      authors: ['An Author'],
      importKey: 'key',
      pendingImportPlacements: [{
        _key: 'reader-1',
        reader: {_ref: 'reader-1'},
        shelfStatus: 'finished',
        rating: 4,
        addedAt: '2019-06-01',
        finishedAt: '2020-01-02',
      }],
    },
    {
      _id: 'failure-1',
      _type: 'catalogImportFailure',
      reader: {_ref: 'reader-1'},
      book: {_ref: 'book-1'},
    },
  ])
  const result = await placePendingGoodreadsImports(client, 'book-1')
  assert.equal(result.placed, 1)
  const entry = [...docs.values()].find((doc) => doc._type === 'shelfEntry')!
  assert.equal(ref(entry.book), 'book-1')
  assert.equal(ref(entry.shelf), 'shelf-reader-1-finished')
  assert.equal(docs.get('progress-reader-1-book-1')?.finishedAt, '2020-01-02')
  assert.equal(docs.get('rating-reader-1-book-1')?.value, 4)
  assert.equal(docs.get('book-1')?.pendingImportPlacements, undefined)
  assert.ok(docs.get('failure-1')?.resolvedAt)
})

test('a draft cannot be placed on a shelf until it is published', async () => {
  const {client} = database([{_id: 'book-1', _type: 'book', title: 'A Book'}])
  await assert.rejects(placePendingGoodreadsImports(client, 'drafts.book-1'), /Publish the book/)
})
