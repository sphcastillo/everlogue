import assert from 'node:assert/strict'
import {test} from 'node:test'
import {evaluate, parse} from 'groq-js'
import type {SanityClient} from '@sanity/client'
import {normalizeIsbn} from '../src/lib/isbn'
import {findBookEdition, getBookEditions, resolveCatalogBookId} from '../src/lib/book-editions'
import {bookCoverProjection, shelfBookCoverProjection} from '../src/sanity/queries'
import {resolveEditionMetadata} from '../src/lib/edition-metadata'
import {saveBookEdition} from '../src/lib/library-book'

test('catalog book ids resolve from the published id or slug', async () => {
  const dataset = [
    {_id: 'book-1', _type: 'book', slug: {current: 'hamnet'}},
    {_id: 'drafts.book-1', _type: 'book', slug: {current: 'hamnet'}},
  ]
  const client = {
    async fetch(query: string, params: {id: string}) {
      return (await evaluate(parse(query), {dataset, params})).get()
    },
  } as unknown as SanityClient
  assert.equal(await resolveCatalogBookId(client, 'hamnet'), 'book-1')
  assert.equal(await resolveCatalogBookId(client, 'book-1'), 'book-1')
  assert.equal(await resolveCatalogBookId(client, 'missing'), null)
})

test('ISBN validation unifies hyphens, spaces, ISBN-10 and ISBN-13, and rejects bad checksums', () => {
  for (const isbn of ['9780306406157', '978-0-306-40615-7', '0 306 40615 2']) assert.equal(normalizeIsbn(isbn), '9780306406157')
  assert.equal(normalizeIsbn('080442957x'), '9780804429573')
  for (const isbn of ['9780306406158', '1234567890128', '0306406153', 'not an ISBN']) assert.equal(normalizeIsbn(isbn), undefined)
})

test('publishing history orders partial and provider-written dates chronologically, with unknown dates last', async () => {
  const client = {fetch: async () => [
    {_id: 'unknown'}, {_id: 'new', publicationDate: '2010'},
    {_id: 'old', publicationDate: 'April 2003'}, {_id: 'middle', publicationDate: '2005-06'},
  ]} as unknown as SanityClient
  assert.deepEqual((await getBookEditions(client, 'book')).map((edition) => edition._id), ['old', 'middle', 'new', 'unknown'])
})

test('ISBN lookup reuses existing editions, rejects other books, and refuses unverified work matches', async () => {
  let existing: {_id: string; bookId: string; editorialLocked: boolean} | null = {_id: 'edition', bookId: 'book', editorialLocked: true}
  const client = {fetch: async (query: string) => query.includes('_type == "edition"') ? existing : {title: 'Book', authors: ['Author']}} as unknown as SanityClient
  const noLookup = async () => { throw new Error('Unexpected metadata lookup') }
  assert.equal(await findBookEdition(client, 'book', '0-306-40615-2', noLookup), 'edition')
  await assert.rejects(findBookEdition(client, 'other', '9780306406157', noLookup), /another catalog book/)
  await assert.rejects(findBookEdition(client, 'book', '9780306406158', noLookup), /valid ISBN/)
  existing = null
  await assert.rejects(findBookEdition(client, 'book', '9780306406157', async () => ({title: 'Other book', authors: ['Author'], needsCover: true})), /could not verify/)
})

test('edition metadata uses the exact ISBN and preserves format, translation and partial publication dates', async () => {
  const fetcher = (async (url: string, options?: RequestInit) => {
    if (options?.method === 'HEAD') return new Response(null, {status: 404})
    if (url.includes('/authors/')) return Response.json({name: 'Author'})
    return Response.json({
      isbn_13: ['9780306406157'], key: '/books/OL1M', title: 'Book', authors: [{key: '/authors/OL1A'}],
      publishers: ['Publisher'], publish_date: '2001-02', number_of_pages: 240, physical_format: 'Paperback',
      languages: [{key: '/languages/fre'}], works: [{key: '/works/OL1W'}], edition_name: 'Revised edition',
      contributions: [{role: 'Translator', name: 'Translator Name'}],
    })
  }) as typeof fetch
  const metadata = await resolveEditionMetadata({title: 'Book', author: 'Author', isbn13: '9780306406157'}, {fetcher, googleKey: '', pace: async () => {}})
  assert.equal(metadata.pageCount, 240)
  assert.equal(metadata.publicationDate, '2001-02')
  assert.equal(metadata.language, 'fre')
  assert.equal(metadata.format, 'paperback')
  assert.equal(metadata.editionStatement, 'Revised edition')
  assert.deepEqual(metadata.translators, ['Translator Name'])
  assert.deepEqual(metadata.authors, ['Author'])
})

test('catalog keeps its preferred image; shelves use the selected edition and fall back when it has no cover', async () => {
  const dataset = [
    {_id: 'asset', _type: 'sanity.imageAsset', url: 'https://cdn.sanity.io/catalog.jpg'},
    {_id: 'book', _type: 'book', coverOverride: {asset: {_ref: 'asset'}}},
    {_id: 'edition', _type: 'edition', book: {_ref: 'book'}, cover: {url: 'https://example.com/edition.jpg'}},
    {_id: 'entry', _type: 'shelfEntry', book: {_ref: 'book'}, edition: {_ref: 'edition'}},
  ]
  async function query(source: string) { return (await evaluate(parse(source), {dataset})).get() }
  const catalog = await query(`*[_id == "book"][0]{"cover": ${bookCoverProjection}}`)
  assert.equal(catalog.cover.coverOverride.asset.url, 'https://cdn.sanity.io/catalog.jpg')
  const shelfQuery = `*[_id == "entry"][0]{"book": book->{"cover": ${shelfBookCoverProjection}}}`
  assert.equal((await query(shelfQuery)).book.cover.cover.url, 'https://example.com/edition.jpg')
  delete dataset[2].cover
  assert.equal((await query(shelfQuery)).book.cover.coverOverride.asset.url, 'https://cdn.sanity.io/catalog.jpg')
})

test('edition selection updates only the authenticated reader’s progress and entries, preserving work identity', async () => {
  const mutations: {id: string; value?: unknown; unset?: string[]}[] = []
  let valid = true
  const client = {
    async fetch(query: string, params: {readerId?: string}) {
      if (query.includes('count')) return query.includes('edition') ? valid : true
      assert.equal(params.readerId, 'reader')
      return query.includes('readingProgress') ? {_id: 'progress'} : [{_id: 'entry'}, {_id: 'custom-entry'}]
    },
    transaction() {
      const tx = {
        patch(id: string, build: (patch: unknown) => unknown) {
          const patch = {set(value: unknown) { mutations.push({id, value}); return patch }, unset(unset: string[]) { mutations.push({id, unset}); return patch }}
          build(patch); return tx
        },
        async commit() {},
      }
      return tx
    },
  } as unknown as SanityClient
  await saveBookEdition(client, 'reader', 'book', 'edition')
  assert.deepEqual(mutations.map((item) => item.id), ['progress', 'entry', 'custom-entry'])
  for (const mutation of mutations) assert.deepEqual(mutation.value, {edition: {_type: 'reference', _ref: 'edition'}})
  mutations.length = 0
  await saveBookEdition(client, 'reader', 'book', null)
  assert.ok(mutations.every((mutation) => mutation.unset?.[0] === 'edition'))
  valid = false
  await assert.rejects(saveBookEdition(client, 'reader', 'book', 'wrong-edition'), /does not belong/)
})
