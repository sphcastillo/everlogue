import assert from 'node:assert/strict'
import {test} from 'node:test'
import {evaluate, parse} from 'groq-js'
import type {SanityClient} from '@sanity/client'
import {loadReaderPreferences} from '../src/lib/companion-preferences'
import {searchRecommendationCatalog} from '../src/lib/companion-catalog'

const ref = (_ref: string) => ({_type: 'reference', _ref})
const docs = [
  ...['loved', 'disliked', 'unrated', 'no-review'].map(_id => ({_id, _type: 'book', title: _id, description: 'Hopeful friendship', categories: ['Fantasy']})),
  ...[['high','loved',5,'me'],['low','disliked',1,'me'],['neutral','no-review',3,'me'],['other','unrated',1,'someone-else']].map(([_id,book,value,reader]) => ({_id,_type:'rating',reader:ref(String(reader)),book:ref(String(book)),value})),
  {_id:'reason',_type:'review',reader:ref('me'),book:ref('disliked'),body:'The slow pacing did not work for me.',visibility:'private'},
  {_id:'unrated-review',_type:'review',reader:ref('me'),book:ref('unrated'),body:'I liked the characters.'},
  {_id:'hidden',_type:'review',reader:ref('me'),book:ref('loved'),body:'Hidden text',moderationStatus:'hidden'},
  {_id:'other-review',_type:'review',reader:ref('someone-else'),book:ref('loved'),body:'Another reader’s private feedback'},
]
const client = {fetch: async (query: string, params: Record<string, unknown>) => (await evaluate(parse(query), {dataset: docs, params})).get()} as unknown as SanityClient

test('loads only the authenticated reader’s ratings and feedback, including private reviews and off-shelf books', async () => {
  const result = await loadReaderPreferences(client, 'me')
  assert.equal(result.ratings.length, 3)
  assert.deepEqual(result.ratings.map((r: {value:number})=>r.value).sort(), [1,3,5])
  assert.equal(result.reviews.length, 2)
  assert.equal(result.reviews.find((r: {book:{_id:string}})=>r.book._id === 'disliked').body, 'The slow pacing did not work for me.')
  assert.equal(result.reviews.find((r: {book:{_id:string}})=>r.book._id === 'unrated').rating, null)
})
test('guests never query personal ratings', async () => {
  const noFetch = {fetch: () => {throw new Error('Must not query')}} as unknown as SanityClient
  assert.equal((await loadReaderPreferences(noFetch, null)).status, 'guest')
})
test('ratings do not filter catalog candidates or block an entire genre', async () => {
  const books = await searchRecommendationCatalog(client, ['Fantasy'], 'me')
  assert.equal(books.length, 4)
  assert.ok(books.some(book => book._id === 'unrated'))
})
