import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SanityClient} from '@sanity/client'
import type {GoogleBook} from '../src/lib/google-books'
import {resolveSearchBook} from '../src/lib/search-book'
import {searchCatalogParams} from '../src/lib/search-catalog'

type Doc = Record<string, unknown> & {_id: string}
const book: GoogleBook = {id: 'volume-1', volumeInfo: {
  title: 'A Book', authors: ['An Author'], description: '<p>A description.</p>',
  industryIdentifiers: [{type: 'ISBN_13', identifier: '9780140328721'}],
  imageLinks: {thumbnail: 'http://books.google.com/cover?zoom=1'},
}}

function database(initial: Doc[] = [], fail = false) {
  const docs = new Map(initial.map((doc) => [doc._id, {...doc}]))
  let sequence = 0
  const client = {
    async fetch(_query: string, params: {id: string; isbn10: string; isbn13: string}) {
      const all = [...docs.values()].filter((doc) => !doc._id.startsWith('drafts.'))
      const matches = (doc: Doc) => doc.googleBooksId === params.id || (params.isbn13 && doc.isbn13 === params.isbn13) || (params.isbn10 && doc.isbn10 === params.isbn10)
      const edition = all.find((doc) => doc._type === 'edition' && matches(doc))
      return all.find((doc) => doc._type === 'book' && (matches(doc) || doc._id === (edition?.book as {_ref?: string})?._ref))?._id || null
    },
    transaction() {
      const pending: Doc[] = []
      const tx = {
        create(doc: Record<string, unknown>) {
          pending.push({...doc, _id: String(doc._id || `generated-${++sequence}`)})
          return tx
        },
        async commit() {
          if (fail) throw new Error('Network failure')
          if (pending.some((doc) => docs.has(doc._id))) throw Object.assign(new Error('Conflict'), {statusCode: 409})
          for (const doc of pending) docs.set(doc._id, doc)
        },
      }
      return tx
    },
  } as unknown as SanityClient
  return {client, docs}
}

test('new search books retain metadata and enter the review queue; repeats keep editorial changes', async () => {
  const {client, docs} = database()
  const id = await resolveSearchBook(client, book, true)
  const saved = docs.get(id!)!
  assert.equal(saved.title, 'A Book')
  assert.equal(saved.description, 'A description.')
  assert.deepEqual(saved.authors, ['An Author'])
  assert.equal(saved.catalogSource, 'readerSearch')
  assert.equal(saved.catalogReviewStatus, 'needsReview')
  assert.equal(saved.isbn13, '9780140328721')
  assert.equal((saved.cover as {url: string}).url, 'https://books.google.com/cover?zoom=3')
  saved.title = 'Editorial title'
  saved.catalogReviewStatus = 'reviewed'
  assert.equal(await resolveSearchBook(client, book, true), id)
  assert.equal(saved.title, 'Editorial title')
  assert.equal(saved.catalogReviewStatus, 'reviewed')
})

test('simultaneous saves and different Google volumes with the same ISBN reuse one book', async () => {
  const {client, docs} = database()
  const ids = await Promise.all([
    resolveSearchBook(client, book, true),
    resolveSearchBook(client, book, true),
    resolveSearchBook(client, {...book, id: 'another-volume'}, true),
  ])
  assert.ok(ids[0])
  assert.ok(ids.every((id) => id === ids[0]))
  assert.equal([...docs.values()].filter((doc) => doc._type === 'book').length, 1)
})

test('existing edition ISBN resolves to its book without creating a review request', async () => {
  const {client, docs} = database([
    {_id: 'catalog-book', _type: 'book', title: 'Existing'},
    {_id: 'edition', _type: 'edition', isbn13: '9780140328721', book: {_ref: 'catalog-book'}},
  ])
  assert.equal(await resolveSearchBook(client, book, true), 'catalog-book')
  assert.equal(docs.size, 2)
  assert.equal(docs.get('catalog-book')?.catalogReviewStatus, undefined)
})

test('clearing an unsaved title creates nothing, and failed writes do not report success', async () => {
  const {client, docs} = database()
  assert.equal(await resolveSearchBook(client, book, false), null)
  assert.equal(docs.size, 0)
  await assert.rejects(resolveSearchBook(database([], true).client, book, true), /Network failure/)
  await assert.rejects(resolveSearchBook(client, {id: 'no-title'}, true), /no title/)
  assert.equal(docs.size, 0)
})

test('ISBN-10 search metadata also matches catalog ISBN-13 records', () => {
  assert.deepEqual(searchCatalogParams({id: 'volume', volumeInfo: {
    industryIdentifiers: [{type: 'ISBN_10', identifier: '0140328726'}],
  }}), {id: 'volume', isbn10: '0140328726', isbn13: '9780140328721'})
})
