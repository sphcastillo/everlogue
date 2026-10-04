import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SanityClient} from '@sanity/client'
import {importGoodreadsBook} from '../src/lib/goodreads-import'
import type {GoodreadsBook} from '../src/lib/goodreads-csv'

type Doc = Record<string, unknown> & {_id: string}
const book: GoodreadsBook = {row: 2, title: 'A Book', author: 'An Author', status: 'finished', rating: 4, finishedAt: '2020-01-02', addedAt: '2019-06-01', readCount: 2}
const ref = (value: unknown) => (value as {_ref?: string} | undefined)?._ref

function database(initial: Doc[] = []) {
  const docs = new Map(initial.map((doc) => [doc._id, {...doc}]))
  let sequence = 0, fail = false
  const client = {
    async fetch(query: string, params: Record<string, string>) {
      const all = [...docs.values()]
      if (query.includes('$bareTitle')) {
        return all.filter((doc) => doc._type === 'book' && (
          String(doc.title).toLowerCase() === params.title ||
          String(doc.title).toLowerCase() === params.bareTitle
        ))
      }
      if (query.startsWith('coalesce')) return all.find((doc) => doc._type === 'book' && (doc.importKey === params.importKey || String(doc.title).toLowerCase() === params.title))?._id || null
      if (query.includes('_type == "author"')) return all.find((doc) => doc._type === 'author')?._id || null
      if (query.includes('_type == "rating"')) {
        const ratings = all.filter((doc) => doc._type === 'rating' && ref(doc.book) === params.bookId && (!params.readerId || ref(doc.reader) === params.readerId))
        return query.includes('.value') ? ratings.map((doc) => doc.value) : ratings.length > 0
      }
      return all.some((doc) => doc._type === 'readingProgress' && ref(doc.reader) === params.readerId && ref(doc.book) === params.bookId)
    },
    async create(doc: Record<string, unknown>) {
      const result = {...doc, _id: String(doc._id || `generated-${++sequence}`)}
      docs.set(result._id, result)
      return result
    },
    async createIfNotExists(doc: Doc) {
      if (!docs.has(doc._id)) docs.set(doc._id, {...doc})
      return docs.get(doc._id)
    },
    patch(id: string) {
      return {set: (fields: object) => ({commit: async () => {
        docs.set(id, {...docs.get(id)!, ...fields})
      }})}
    },
    transaction() {
      const pending: Doc[] = []
      const tx = {
        create(doc: Record<string, unknown>) {
          pending.push({...doc, _id: String(doc._id || `generated-${++sequence}`)})
          return tx
        },
        async commit() {
          if (fail && pending.some((doc) => doc._type === 'shelfEntry')) throw new Error('Network failure')
          if (pending.some((doc) => docs.has(doc._id))) throw Object.assign(new Error('Conflict'), {statusCode: 409})
          for (const doc of pending) docs.set(doc._id, doc)
        },
      }
      return tx
    },
  } as unknown as SanityClient
  return {client, docs, setFailure: (value: boolean) => { fail = value }}
}

test('saves imported dates and correct shelf, preserving existing entries on reimport', async () => {
  const {client, docs} = database([{_id: 'existing-book', _type: 'book', title: book.title}])
  assert.equal((await importGoodreadsBook(client, 'reader-1', book)).status, 'imported')
  const progress = docs.get('progress-reader-1-existing-book')!
  assert.equal(progress.finishedAt, '2020-01-02')
  assert.equal(progress.readCount, 2)
  const entry = [...docs.values()].find((doc) => doc._type === 'shelfEntry')!
  assert.equal(ref(entry.shelf), 'shelf-reader-1-finished')
  assert.equal(entry.addedAt, '2019-06-01T00:00:00.000Z')
  const rating = [...docs.values()].find((doc) => doc._type === 'rating')!
  assert.equal(rating.value, 4)
  assert.equal((await importGoodreadsBook(client, 'reader-1', {...book, status: 'wantToRead'})).status, 'skipped')
  assert.equal(progress.status, 'finished')
  assert.equal((await importGoodreadsBook(client, 'reader-2', book)).status, 'imported')
})

test('reimport fills a missing rating without changing the existing shelf or dates', async () => {
  const {client, docs} = database([{_id: 'existing-book', _type: 'book', title: book.title}])
  await importGoodreadsBook(client, 'reader', {...book, rating: undefined, status: 'wantToRead'})
  assert.equal((await importGoodreadsBook(client, 'reader', book)).status, 'updated')
  assert.equal(docs.get('rating-reader-existing-book')?.value, 4)
  assert.equal(docs.get('progress-reader-existing-book')?.status, 'wantToRead')
  assert.equal((docs.get('existing-book')?.ratingStats as {average: number}).average, 4)
  assert.equal((await importGoodreadsBook(client, 'reader', {...book, rating: 5})).status, 'skipped')
  assert.equal(docs.get('rating-reader-existing-book')?.value, 4)
})

test('an existing catalog book is reused when the Goodreads title has a series suffix', async () => {
  const {client, docs} = database([
    {_id: 'existing-book', _type: 'book', title: 'The Last Thing He Told Me', authors: ['Laura Dave']},
  ])
  const result = await importGoodreadsBook(client, 'reader', {
    ...book,
    title: 'The Last Thing He Told Me (Hannah Hall, #1)',
    author: 'Laura Dave',
  })
  assert.equal(result.status, 'imported')
  assert.equal([...docs.values()].filter((doc) => doc._type === 'book').length, 1)
  assert.equal(docs.get('existing-book')?.catalogReviewStatus, undefined)
})

test('a pre-existing catalog book is reused and is not queued for review', async () => {
  const {client, docs} = database([{_id: 'existing-book', _type: 'book', title: book.title}])
  await importGoodreadsBook(client, 'reader', book)
  assert.equal(docs.get('existing-book')?.catalogReviewStatus, undefined)
  assert.equal(docs.get('existing-book')?.catalogSource, undefined)
})

test('a pre-existing rating does not prevent importing shelf membership', async () => {
  const {client, docs} = database([
    {_id: 'existing-book', _type: 'book', title: book.title},
    {_id: 'rating-reader-existing-book', _type: 'rating', reader: {_ref: 'reader'}, book: {_ref: 'existing-book'}, value: 2},
  ])
  assert.equal((await importGoodreadsBook(client, 'reader', book)).status, 'imported')
  assert.equal(docs.get('rating-reader-existing-book')?.value, 2)
  assert.ok(docs.has('progress-reader-existing-book'))
})

test('concurrent imports create one book and one library entry', async () => {
  const {client, docs} = database()
  const results = await Promise.all([importGoodreadsBook(client, 'reader', book), importGoodreadsBook(client, 'reader', book)])
  assert.equal(results.filter((result) => result.status === 'imported').length, 1)
  assert.equal([...docs.values()].filter((doc) => doc._type === 'book').length, 1)
  assert.equal([...docs.values()].filter((doc) => doc._type === 'shelfEntry').length, 1)
  const created = [...docs.values()].find((doc) => doc._type === 'book')!
  assert.equal(created.catalogSource, 'goodreadsImport')
  assert.equal(created.catalogReviewStatus, 'needsReview')
})

test('failed writes leave no partial reading progress and can be retried', async () => {
  const {client, docs, setFailure} = database()
  setFailure(true)
  await assert.rejects(importGoodreadsBook(client, 'reader', book), /Network failure/)
  assert.equal([...docs.values()].filter((doc) => doc._type === 'readingProgress').length, 0)
  setFailure(false)
  assert.equal((await importGoodreadsBook(client, 'reader', book)).status, 'imported')
  assert.equal([...docs.values()].filter((doc) => doc._type === 'book').length, 1)
})
