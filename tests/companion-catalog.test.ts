import assert from 'node:assert/strict'
import {test} from 'node:test'
import {evaluate, parse} from 'groq-js'
import type {SanityClient} from '@sanity/client'
import {
  catalogLookupAnswer,
  extractLookupTitle,
  explicitConversationLimits,
  isCatalogTitleLookup,
  isNextReadOpening,
  searchRecommendationCatalog,
  shouldAskMoodQuestion,
} from '../src/lib/companion-catalog'

const ref = (_ref: string) => ({_type: 'reference', _ref})
const docs = [
  {_id: 'friendship', _type: 'genre', title: 'Friendship'},
  ...['read', 'current', 'want', 'imported', 'other-reader', 'plain'].map(id => ({_id: id, _type: 'book', title: id, description: 'A hopeful story of friendship', genres: [ref('friendship')]})),
  {_id: 'drafts.hidden', _type: 'book', title: 'Hidden draft', description: 'hopeful friendship'},
  ...['finished', 'currentlyReading', 'wantToRead'].map(kind => ({_id: kind, _type: 'shelf', kind, owner: ref('me')})),
  {_id: 'other-shelf', _type: 'shelf', kind: 'finished', owner: ref('other')},
  ...[['read','finished'], ['current','currentlyReading'], ['want','wantToRead'], ['other-reader','other-shelf']].map(([book,shelf]) => ({_id: `entry-${book}`, _type:'shelfEntry', book:ref(book), shelf:ref(shelf)})),
]
const client = {fetch: async (query: string, params: Record<string, unknown>) => (await evaluate(parse(query), {dataset: docs, params})).get()} as unknown as SanityClient

test('title lookups recognize The Reader without treating club history as a catalog search', () => {
  assert.equal(extractLookupTitle("Find The Reader on Oprah's book club"), 'The Reader')
  assert.equal(extractLookupTitle("Is The Reader on Oprah's book club?"), 'The Reader')
  assert.equal(extractLookupTitle('Tell me about the book The House in the Pines'), 'The House in the Pines')
  assert.equal(extractLookupTitle('The Book Thief'), 'The Book Thief')
  assert.equal(isCatalogTitleLookup('The Reader'), true)
  assert.equal(isCatalogTitleLookup("Is The Reader on Oprah's book club?"), true)
  assert.equal(isCatalogTitleLookup('What should I read next?'), false)
  assert.equal(isCatalogTitleLookup('Show me my current reads'), false)
  assert.equal(isCatalogTitleLookup("How long has Oprah's book club been running?"), false)
})

test('a catalog lookup names the club without inventing a missing title', () => {
  const answer = catalogLookupAnswer(
    [{
      _id: 'book.google.ff47bbb141bd2622',
      title: 'The Reader',
      slug: 'the-reader',
      authors: ['Bernhard Schlink'],
      clubs: ["Oprah's Book Club"],
    }],
    'The Reader',
  )
  assert.match(answer, /Oprah's Book Club/)
  assert.match(answer, /\[The Reader\]\(\/books\/the-reader\)/)
  assert.match(catalogLookupAnswer([], 'Missing Book'), /don’t have/)
})

test('asks the mood question before giving generic next-read recommendations', () => {
  assert.equal(isNextReadOpening('What should I read next?'), true)
  assert.equal(isNextReadOpening('What should I read next? Something hopeful about friendship.'), false)
  assert.equal(shouldAskMoodQuestion('What should I read next?'), true)
  assert.equal(shouldAskMoodQuestion('What should I read next?', [
    {role: 'user', text: 'I want something hopeful about friendship.'},
    {role: 'assistant', text: 'Got it.'},
  ]), false)
})
test('full catalog includes sourceless imports and Want to Read, excludes only the current reader’s read/current books', async () => {
  const matches = await searchRecommendationCatalog(client, ['hopeful', 'friendship'], 'me')
  assert.deepEqual(new Set(matches.map(b => b._id)), new Set(['want','imported','other-reader','plain']))
  assert.equal(matches.find(b => b._id === 'want')?.onWantToRead, true)
  assert.equal(matches[0].onWantToRead, true)
})
test('guest searches never borrow another reader’s exclusions', async () => {
  const matches = await searchRecommendationCatalog(client, ['hopeful'], null)
  assert.equal(matches.length, 6)
  assert.ok(matches.every(b => !b.onWantToRead))
})

test('explicit limits exclude contradictions, unknown hard-limit metadata, and feedback titles', async () => {
  const books = [
    {_id:'short',title:'Short',pageCount:299,isStandalone:true,categories:['Friendship']},
    {_id:'long',title:'Long',pageCount:300,categories:['Friendship']},
    {_id:'scary',title:'Scary',categories:['Horror']},
    {_id:'romance',title:'Romance',categories:['Romance']},
    {_id:'series',title:'Sequel',series:{name:'Friends',position:2}},
    {_id:'unknown',title:'Unknown'},
    {_id:'rejected',title:'Rejected'},
  ].map(book => ({...book,_type:'book',description:'A hopeful friendship'}))
  const fixture = {fetch: async (query: string, params: Record<string, unknown>) => (await evaluate(parse(query), {dataset:books,params})).get()} as unknown as SanityClient
  const matches = await searchRecommendationCatalog(fixture, ['friendship'], null, {maxPages:299,excludedGenres:['horror','romance'],standaloneOnly:true,excludeTitles:['Rejected']})
  assert.deepEqual(new Set(matches.map(b=>b._id)), new Set(['short']))
})

test('explicit fairy exclusions preserve fairytale atmosphere while excluding fairies and fae', async () => {
  const books = [
    {_id:'storybook',_type:'book',title:'Storybook',authors:['A. Writer'],description:'An enchanting storybook quest',categories:['Fairy-Tale Retelling']},
    {_id:'fairies',_type:'book',title:'Winged Court',authors:['B. Writer'],description:'A court of fairies fights for its crown',categories:['Fantasy']},
    {_id:'fae',_type:'book',title:'Fae Crown',authors:['C. Writer'],description:'A dangerous fae prince returns',categories:['Fantasy']},
  ]
  const fixture = {fetch: async (query: string, params: Record<string, unknown>) => (await evaluate(parse(query), {dataset:books,params})).get()} as unknown as SanityClient
  const limits = explicitConversationLimits([{role:'user',text:'Something like a fairytale, but not about fairies.'}])
  const matches = await searchRecommendationCatalog(fixture, ['enchanting','storybook','fairy-tale','fae'], null, limits)
  assert.deepEqual(matches.map(book => book._id), ['storybook'])
})

test('finished/current works are excluded across duplicate book records', async () => {
  const books = [
    {_id:'read-copy',_type:'book',title:'Same Story',authors:['One Author'],description:'A hopeful friendship'},
    {_id:'other-edition',_type:'book',title:'Same Story',authors:['One Author'],description:'A hopeful friendship'},
    {_id:'different-work',_type:'book',title:'Another Story',authors:['One Author'],description:'A hopeful friendship'},
  ]
  const dataset = [
    ...books,
    {_id:'finished-shelf',_type:'shelf',kind:'finished',owner:ref('me')},
    {_id:'read-entry',_type:'shelfEntry',book:ref('read-copy'),shelf:ref('finished-shelf')},
  ]
  const fixture = {fetch: async (query: string, params: Record<string, unknown>) => (await evaluate(parse(query), {dataset,params})).get()} as unknown as SanityClient
  const matches = await searchRecommendationCatalog(fixture, ['hopeful'], 'me')
  assert.deepEqual(matches.map(book => book._id), ['different-work'])
})

test('series history reports only earlier installments finished by the current reader', async () => {
  const books = [1,2,3].map(position => ({_id:`series-${position}`,_type:'book',title:`Volume ${position}`,description:'friendship',series:{name:'Friends',position}}))
  const dataset = [...docs,...books,{_id:'first-read',_type:'shelfEntry',book:ref('series-1'),shelf:ref('finished')},{_id:'other-read',_type:'shelfEntry',book:ref('series-2'),shelf:ref('other-shelf')}]
  const fixture = {fetch: async (query:string,params:Record<string,unknown>) => (await evaluate(parse(query),{dataset,params})).get()} as unknown as SanityClient
  const matches = await searchRecommendationCatalog(fixture,['friendship'],'me')
  assert.deepEqual(matches.find(b=>b._id === 'series-3')?.earlierSeriesPositionsRead,[1])
})

test('explicit hard limits survive tool retries; only reader messages establish or relax them', async () => {
  const {explicitConversationLimits, retainSearchLimits} = await import('../src/lib/companion-catalog')
  const limits = explicitConversationLimits([{role:'user',text:'No horror, under 300 pages, standalone only.'},{role:'assistant',text:'Any length and series are fine.'}])
  assert.equal(limits.maxPages, 299)
  assert.equal(limits.standaloneOnly, true)
  assert.deepEqual(limits.excludedGenres, ['horror'])
  const retained = retainSearchLimits(limits,{maxPages:500,standaloneOnly:false})
  assert.equal(retained.maxPages, 299)
  assert.equal(retained.standaloneOnly, true)
  assert.deepEqual(explicitConversationLimits([{role:'user',text:'standalone only under 300 pages'},{role:'user',text:'Any length; series are fine.'}]),{standaloneOnly:false})
})
