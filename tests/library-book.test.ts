import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SanityClient} from '@sanity/client'
import {saveBookRating, saveBookStatus, saveBookReview} from '../src/lib/library-book'
import {shelfBookSchema} from '../src/lib/validation'

type Doc = {_id: string; _type: string; [key: string]: unknown}

test('missing catalog IDs are rejected before sending a GROQ query', async () => {
  let queried = false
  const client = {fetch: async () => { queried = true; throw new Error('Unexpected query') }} as unknown as SanityClient
  for (const id of [undefined, null, '', '   ']) {
    await assert.rejects(saveBookStatus(client, 'reader', id as unknown as string, 'wantToRead'), /catalog book ID is required/)
    await assert.rejects(saveBookRating(client, 'reader', id as unknown as string, 4), /catalog book ID is required/)
  }
  assert.equal(queried, false)
})

test('shelf requests identify the source and require its ID', () => {
  assert.deepEqual(shelfBookSchema.parse({source: 'googleBooks', id: 'qAthDgAAQBAJ'}), {source: 'googleBooks', id: 'qAthDgAAQBAJ'})
  assert.deepEqual(shelfBookSchema.parse({source: 'catalog', id: 'catalog-book'}), {source: 'catalog', id: 'catalog-book'})
  for (const source of ['googleBooks', 'catalog']) {
    for (const id of [undefined, null, '', '   ']) assert.equal(shelfBookSchema.safeParse({source, id}).success, false)
  }
})
const ref = (value: unknown) => (value as {_ref?: string} | undefined)?._ref
const reference = (_ref: string) => ({_type: 'reference', _ref})

function database() {
  const docs = new Map<string, Doc>([
    ['book-new', {_id: 'book-new', _type: 'book', title: 'A Book'}],
    ['rating-reader-old', {_id: 'rating-reader-old', _type: 'rating', reader: reference('reader'), book: reference('book-new'), value: 4}],
    ['progress-reader-old', {_id: 'progress-reader-old', _type: 'readingProgress', reader: reference('reader'), book: reference('book-new'), status: 'finished', finishedAt: '2020-01-02', readCount: 2, importSource: 'goodreads', edition: reference('edition')}],
    ['old-entry', {_id: 'old-entry', _type: 'shelfEntry', book: reference('book-new'), shelf: reference('finished'), addedAt: '2019-06-01'}],
    ...['finished', 'currentlyReading', 'wantToRead'].map((kind): [string, Doc] => [kind, {_id: kind, _type: 'shelf', owner: reference('reader'), kind}]),
  ])
  function patch(id: string, pending?: (() => void)[]) {
    const updates: (() => void)[] = []
    const builder = {
      set(fields: object) { updates.push(() => docs.set(id, {...docs.get(id)!, ...fields})); return builder },
      setIfMissing(fields: object) {
        updates.push(() => { const doc = docs.get(id)!; for (const [key, value] of Object.entries(fields)) if (doc[key] === undefined) doc[key] = value })
        return builder
      },
      async commit() { updates.forEach((update) => update()) },
    }
    pending?.push(() => updates.forEach((update) => update()))
    return builder
  }
  const client = {
    async fetch(query: string, params: {readerId?: string; bookId?: string}) {
      const all = [...docs.values()]
      if (query.startsWith('count')) return docs.get(params.bookId!)?._type === 'book'
      const relevant = all.filter((doc) => ref(doc.book) === params.bookId && (!params.readerId || ref(doc.reader) === params.readerId))
      if (query.startsWith('*[_type == "rating"')) {
        const ratings = relevant.filter((doc) => doc._type === 'rating')
        return query.endsWith('.value') ? ratings.map((doc) => doc.value) : ratings[0] || null
      }
      if (query.startsWith('*[_type == "review"')) return relevant.find((doc) => doc._type === 'review') || null
      if (query.startsWith('*[_type == "readingProgress"')) {
        const progress = relevant.find((doc) => doc._type === 'readingProgress') || null
        return query.endsWith('.status') ? progress?.status ?? null : progress
      }
      if (query.startsWith('*[_type == "shelf"')) return all.filter((doc) => doc._type === 'shelf' && ref(doc.owner) === params.readerId)
      if (query.startsWith('*[_type == "shelfEntry"')) return all.filter((doc) => doc._type === 'shelfEntry' && ref(doc.book) === params.bookId && ref(docs.get(String(ref(doc.shelf)))?.owner) === params.readerId).map((doc) => ({...doc, shelfId: ref(doc.shelf)}))
      throw new Error('Unexpected query')
    },
    patch,
    async delete(id: string) { docs.delete(id) },
    async createOrReplace(doc: Doc) { docs.set(doc._id, {...doc}) },
    transaction() {
      const pending: (() => void)[] = []
      const tx = {
        delete(id: string) { pending.push(() => { docs.delete(id) }); return tx },
        createIfNotExists(doc: Doc) { pending.push(() => { if (!docs.has(doc._id)) docs.set(doc._id, {...doc}) }); return tx },
        patch(id: string, build: (builder: ReturnType<typeof patch>) => unknown) { build(patch(id, pending)); return tx },
        serialize() { return pending },
        async commit() { pending.forEach((mutation) => mutation()) },
      }
      return tx
    },
  } as unknown as SanityClient
  return {docs, client}
}

test('updates and clears migrated ratings using their preserved IDs', async () => {
  const {docs, client} = database()
  await saveBookRating(client, 'reader', 'book-new', 3)
  assert.equal(docs.get('rating-reader-old')?.value, 3)
  assert.equal([...docs.values()].filter((doc) => doc._type === 'rating').length, 1)
  assert.equal((docs.get('book-new')?.ratingStats as {average: number}).average, 3)
  await saveBookRating(client, 'reader', 'book-new', null)
  assert.equal([...docs.values()].filter((doc) => doc._type === 'rating').length, 0)
})

test('ratings require a Currently Reading or Read status', async () => {
  const {docs, client} = database()
  await saveBookStatus(client, 'reader', 'book-new', 'wantToRead')
  await assert.rejects(
    saveBookRating(client, 'reader', 'book-new', 4.5),
    /Currently Reading or Read/,
  )
  assert.equal(docs.get('rating-reader-old')?.value, 4)

  await saveBookStatus(client, 'reader', 'book-new', 'currentlyReading')
  await saveBookRating(client, 'reader', 'book-new', 4.5)
  assert.equal(docs.get('rating-reader-old')?.value, 4.5)
})

test('re-saving and moving a migrated book preserves imported reading history', async () => {
  const {docs, client} = database()
  await saveBookStatus(client, 'reader', 'book-new', 'finished')
  assert.equal(docs.get('old-entry')?.addedAt, '2019-06-01')
  await saveBookStatus(client, 'reader', 'book-new', 'currentlyReading')
  assert.equal(docs.has('old-entry'), false)
  const progress = docs.get('progress-reader-old')!
  assert.equal(progress.status, 'currentlyReading')
  assert.equal(progress.finishedAt, '2020-01-02')
  assert.equal(progress.readCount, 2)
  assert.equal(progress.importSource, 'goodreads')
  assert.equal([...docs.values()].filter((doc) => doc._type === 'readingProgress').length, 1)
  const entry = [...docs.values()].find((doc) => doc._type === 'shelfEntry')!
  assert.equal(ref(entry.shelf), 'currentlyReading')
  assert.equal(ref(entry.edition), 'edition')
  await saveBookStatus(client, 'reader', 'book-new', null)
  assert.equal(docs.has('progress-reader-old'), false)
  assert.equal([...docs.values()].filter((doc) => doc._type === 'shelfEntry').length, 0)
})

test('rejects invalid statuses before changing shelves', async () => {
  const {docs, client} = database()
  await assert.rejects(saveBookStatus(client, 'reader', 'book-new', 'invalid'))
  assert.ok(docs.has('old-entry'))
  assert.equal(docs.get('progress-reader-old')?.status, 'finished')
})

test('reviews can be written only after the book is Read', async () => {
  const {docs, client} = database()
  await saveBookStatus(client, 'reader', 'book-new', 'currentlyReading')
  await assert.rejects(
    saveBookReview(client, 'reader', 'book-new', {title: 'A keeper', body: 'Loved it.', hasSpoilers: false, visibility: 'private'}),
    /Mark this book as Read/,
  )
  await saveBookStatus(client, 'reader', 'book-new', 'finished')
  await saveBookReview(client, 'reader', 'book-new', {title: 'A keeper', body: 'Loved it.', hasSpoilers: true, visibility: 'public'})
  const created = [...docs.values()].find((doc) => doc._type === 'review')
  assert.equal(created?.title, 'A keeper')
  assert.equal(created?.body, 'Loved it.')
  assert.equal(created?.hasSpoilers, true)
  assert.equal(created?.visibility, 'public')
  await saveBookReview(client, 'reader', 'book-new', {title: 'Still thinking', body: 'Still thinking.', hasSpoilers: false, visibility: 'private'})
  assert.equal([...docs.values()].filter((doc) => doc._type === 'review').length, 1)
  assert.equal([...docs.values()].find((doc) => doc._type === 'review')?.title, 'Still thinking')
  assert.equal([...docs.values()].find((doc) => doc._type === 'review')?.body, 'Still thinking.')
  await saveBookReview(client, 'reader', 'book-new', null)
  assert.equal([...docs.values()].filter((doc) => doc._type === 'review').length, 0)
})
