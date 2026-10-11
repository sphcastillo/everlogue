import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createHash} from 'node:crypto'
import {createClient, type SanityClient} from '@sanity/client'
import {editionTitleAuthorMismatch} from '../src/lib/edition-title-mismatch'
import {promoteBookIsbnEdition} from '../src/lib/promote-book-isbn-edition'

type Doc = Record<string, unknown> & {_id: string; _type: string}
function database(initial: Record<string, unknown>[] = []) {
  const docs = new Map<string, Doc>()
  const real = createClient({projectId: 'test123', dataset: 'test', apiVersion: '2026-09-01', useCdn: false})
  let sequence = 0
  const save = (doc: Record<string, unknown>) => {
    const result = {...structuredClone(doc), _id: String(doc._id || `generated-${++sequence}`)} as Doc
    docs.set(result._id, result)
    return structuredClone(result)
  }
  initial.forEach(save)
  function commit(mutations: ReturnType<ReturnType<typeof real.transaction>['serialize']>) {
    for (const mutation of mutations) {
      if ('create' in mutation && mutation.create._id && docs.has(mutation.create._id)) throw Object.assign(new Error('Conflict'), {statusCode: 409})
    }
    for (const mutation of mutations) {
      if ('create' in mutation) save(mutation.create)
      if ('patch' in mutation && 'id' in mutation.patch) save({...docs.get(String(mutation.patch.id))!, ...mutation.patch.set})
    }
  }
  const client = {
    async fetch(query: string, params: {isbn?: string; isbn10?: string; bookId?: string} = {}) {
      const editions = [...docs.values()].filter((doc) => doc._type === 'edition')
      const match = editions.find((doc) => doc.isbn13 === params.isbn || (params.isbn10 && doc.isbn10 === params.isbn10))
      if (query.includes('[0]._id')) {
        const found = editions.find((doc) => doc.isbn13 === params.isbn && (doc.book as {_ref?: string})?._ref === params.bookId)
        return found?._id ?? null
      }
      return match ? {_id: match._id, bookId: (match.book as {_ref?: string})?._ref, editorialLocked: match.editorialLocked} : null
    },
    patch(id: string) {
      const patch = real.patch(id)
      patch.commit = async () => { commit([{patch: patch.serialize()}]); return structuredClone(docs.get(id)) as never }
      return patch
    },
    transaction() {
      const tx = real.transaction()
      tx.commit = async () => commit(tx.serialize()) as never
      return tx
    },
  } as unknown as SanityClient
  return {client, docs}
}

const book = {_id: 'book-1', title: 'Hamnet', authors: ['Maggie O\'Farrell'], isbn13: '9780525656968'}
const metadata = {
  isbn13: '9780525656968',
  title: 'Hamnet',
  authors: ['Maggie O\'Farrell'],
  publisher: 'Knopf',
  publicationDate: '2020-07-21',
  pageCount: 372,
  language: 'en',
  format: 'hardcover' as const,
  needsCover: true,
}

test('title/author mismatch ignores shared wording and flags a different work title', () => {
  assert.equal(editionTitleAuthorMismatch('Hamnet', ['Maggie O\'Farrell'], 'Hamnet', ['Maggie O\'Farrell']), false)
  assert.equal(editionTitleAuthorMismatch('The Seven Husbands of Evelyn Hugo: A Novel', ['Taylor Jenkins Reid'], 'The Seven Husbands of Evelyn Hugo', ['Taylor Jenkins Reid']), true)
})

test('dry-run creates no documents and does not invent a second format', async () => {
  const db = database()
  const result = await promoteBookIsbnEdition(db.client, book, {
    resolve: async () => ({...metadata, format: undefined}),
  })
  assert.equal(result.action, 'create')
  assert.equal(result.fields.format, undefined)
  assert.equal(result.fields.isbn13, '9780525656968')
  assert.equal(result.fields.publisher, 'Knopf')
  assert.equal([...db.docs.values()].filter((doc) => doc._type === 'edition').length, 0)
})

test('apply writes one edition for the book ISBN and reuses it on refresh', async () => {
  const db = database()
  const created = await promoteBookIsbnEdition(db.client, book, {apply: true, resolve: async () => metadata})
  assert.equal(created.action, 'create')
  const editions = [...db.docs.values()].filter((doc) => doc._type === 'edition')
  assert.equal(editions.length, 1)
  assert.equal(editions[0].isbn13, '9780525656968')
  assert.deepEqual(editions[0].book, {_type: 'reference', _ref: 'book-1'})
  assert.equal(editions[0].format, 'hardcover')
  const identity = db.docs.get(`editionImportIdentity.${createHash('sha256').update('9780525656968').digest('hex')}`)
  assert.equal(identity?._type, 'catalogImportIdentity')

  const refreshed = await promoteBookIsbnEdition(db.client, book, {
    apply: true,
    resolve: async () => ({...metadata, publisher: 'Alfred A. Knopf', format: 'paperback'}),
  })
  assert.equal(refreshed.action, 'refresh')
  assert.equal(editions.length, 1)
  const edition = [...db.docs.values()].find((doc) => doc._type === 'edition')!
  assert.equal(edition.publisher, 'Alfred A. Knopf')
  assert.equal(edition.format, 'paperback')
})

test('does not attach an ISBN that already belongs to another book', async () => {
  const db = database([{
    _id: 'edition-other', _type: 'edition', isbn13: '9780525656968', book: {_type: 'reference', _ref: 'other-book'},
  }])
  const result = await promoteBookIsbnEdition(db.client, book, {apply: true, resolve: async () => metadata})
  assert.equal(result.action, 'conflict')
  assert.equal([...db.docs.values()].filter((doc) => doc._type === 'edition').length, 1)
})
