import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createClient, type SanityClient} from '@sanity/client'
import {evaluate, parse} from 'groq-js'
import {CLUBS, approvalFor, easternDate, inWindow, type Discovery, type Pick} from '../src/lib/book-club-watch/model'
import {discoverPicks, parseGma, parseOprahAnnouncement, parseReesePage, fetchOfficialHtml} from '../src/lib/book-club-watch/sources'
import {runWatch, persistDiscovery, safeError} from '../src/lib/book-club-watch/service'
import {publishDiscovery} from '../src/lib/book-club-watch/publish'
import {readFileSync} from 'node:fs'

type Doc = Record<string, unknown> & {_id: string; _rev: string; _type: string}
function database(initial: Record<string, unknown>[] = []) {
  const docs = new Map<string, Doc>(), real = createClient({projectId: 'test123', dataset: 'test', apiVersion: '2026-09-01', useCdn: false})
  let sequence = 0, failPublication = false
  const save = (doc: Record<string, unknown>) => {const result = {...structuredClone(doc), _id: String(doc._id || `generated-${++sequence}`), _rev: `rev-${++sequence}`} as Doc; docs.set(result._id, result); return structuredClone(result)}
  initial.forEach(save)
  function commit(mutations: ReturnType<ReturnType<typeof real.transaction>['serialize']>) {
    if (failPublication && mutations.some((m) => 'patch' in m && 'id' in m.patch && String(m.patch.id).startsWith('curatedCollection.'))) throw new Error('Injected failure')
    for (const m of mutations) {
      if ('create' in m && m.create._id && docs.has(m.create._id)) throw Object.assign(new Error('Conflict'), {statusCode: 409})
      if ('patch' in m && 'id' in m.patch && m.patch.ifRevisionID && docs.get(String(m.patch.id))?._rev !== m.patch.ifRevisionID) throw Object.assign(new Error('Revision conflict'), {statusCode: 409})
    }
    for (const m of mutations) {
      if ('create' in m) save(m.create)
      if ('patch' in m && 'id' in m.patch) {
        const doc = {...docs.get(String(m.patch.id))!, ...m.patch.set}
        for (const key of m.patch.unset || []) delete doc[key]
        save(doc)
      }
    }
    return {}
  }
  const client = {
    async fetch(query: string, params = {}) {return (await evaluate(parse(query), {dataset: structuredClone([...docs.values()]), params})).get()},
    async create(doc: Record<string, unknown>) {return save(doc)},
    transaction() {const tx = real.transaction(); tx.commit = async () => commit(tx.serialize()) as never; return tx},
    patch(id: string) {const patch = real.patch(id); patch.commit = async () => {commit([{patch: patch.serialize()}]); return structuredClone(docs.get(id)) as never}; return patch},
  } as unknown as SanityClient
  return {client, docs, save, failPublication: (value: boolean) => {failPublication = value}}
}
const date = new Date('2026-10-06T14:00:00Z')
const pick: Pick = {title: 'A New Book', authors: ['An Author'], selectionMonth: '2026-10', sourceUrl: CLUBS.gma.sourceUrl, evidence: 'October 2026: A New Book by An Author'}
const collection = {_id: CLUBS.gma.collectionId, _type: 'curatedCollection', title: 'GMA', books: [{_key: 'old', selectionNumber: 8, book: {_type: 'reference', _ref: 'old-book'}, year: 2026, month: 'September'}]}
const options = {now: date, discover: async () => [pick], enrich: async () => ({matchConfidence: 0, matchExplanation: 'Manual review'})}
const discoveries = (db: ReturnType<typeof database>) => [...db.docs.values()].filter((d) => d._type === 'bookClubDiscovery') as unknown as Discovery[]
function approve(db: ReturnType<typeof database>, doc: Discovery) {
  const approval = approvalFor({...doc, publicationMode: 'new'})
  db.save({...doc, status: 'approved', approval, reviewedBy: 'editor', approvedAt: date.toISOString()})
}
const fixture = (name: string) => readFileSync(new URL(`./fixtures/book-club-watch/${name}.html`, import.meta.url), 'utf8')

test('Eastern day/month and DST boundaries; schedule guards', () => {
  assert.deepEqual(easternDate(new Date('2026-11-01T03:30:00Z')), {month: '2026-10', day: 31, weekday: 'Sat'})
  assert.equal(easternDate(new Date('2026-03-08T07:30:00Z')).day, 8)
  assert.equal(easternDate(new Date('2026-11-01T06:30:00Z')).day, 1)
  assert.equal(inWindow('reese', new Date('2026-10-09T02:00:00Z')), true)
  assert.equal(inWindow('reese', new Date('2026-10-09T13:00:00Z')), false)
  assert.equal(inWindow('read-with-jenna', new Date('2026-10-05T13:00:00Z')), true)
  assert.equal(inWindow('read-with-jenna', new Date('2026-10-12T13:00:00Z')), false)
  assert.equal(inWindow('gma', new Date('2026-10-27T14:00:00Z')), true)
  assert.equal(inWindow('oprah', new Date('2026-10-07T13:00:00Z')), true)
  assert.equal(inWindow('oprah', date), false)
  assert.deepEqual(Object.values(CLUBS).map((c) => c.schedule), ['0 9 1-8 * *', '0 10 * * 2', '0 9 * * 1,2', '0 9 * * 1,3,5'])
})

test('official-source fixtures retain multiple picks and reject missing source dates', async () => {
  assert.equal(parseReesePage(fixture('reese')).picks[0].selectionMonth, '2026-10')
  assert.equal(parseGma(fixture('gma')).length, 3)
  assert.equal((await discoverPicks('gma', '2026-10', async () => fixture('gma'))).length, 2)
  assert.deepEqual(await discoverPicks('gma', '2026-11', async () => fixture('gma')), [])
  assert.equal((await discoverPicks('read-with-jenna', '2026-10', async () => fixture('jenna'))).length, 2)
  const oprah = parseOprahAnnouncement(fixture('oprah'), 'https://www.oprahdaily.com/announcement')
  assert.equal(oprah[0].title, 'A New Book')
  assert.equal(oprah[0].selectionMonth, '2026-10')
  assert.throws(() => parseOprahAnnouncement(fixture('oprah').replace('article:published_time', 'article:modified_time'), 'https://www.oprahdaily.com/announcement'))
  await assert.rejects(discoverPicks('gma', '2026-10', async () => '<html>Access denied</html>'), /structure/)
  await assert.rejects(fetchOfficialHtml('https://example.com/'), /allowlist/)
})

test('discovery persists before failed enrichment and cannot create catalog content', async () => {
  const db = database([collection])
  const result = await runWatch(db.client, 'gma', {...options, enrich: async (_client, doc) => {
    assert.ok(db.docs.has(doc._id)); throw new Error('secret-token-provider-response')
  }})
  assert.equal(result.outcome, 'discovered')
  assert.equal(discoveries(db)[0].status, 'needs_review')
  assert.ok(discoveries(db)[0].enrichmentError)
  assert.equal([...db.docs.values()].filter((d) => d._type === 'book').length, 0)
  assert.deepEqual(db.docs.get(collection._id)?.books, collection.books)
  assert.doesNotMatch(JSON.stringify([...db.docs.values()]), /secret-token/)
  await publishDiscovery(db.client, discoveries(db)[0]._id)
  assert.equal(discoveries(db)[0].status, 'needs_review')
})

test('repeat runs skip source; concurrent discoveries stay unique; rejection suppresses only same candidate', async () => {
  const db = database([collection])
  const docs = await Promise.all([persistDiscovery(db.client, 'gma', pick, date), persistDiscovery(db.client, 'gma', pick, date)])
  assert.equal(docs[0]._id, docs[1]._id)
  await runWatch(db.client, 'gma', options)
  let fetched = false
  const result = await runWatch(db.client, 'gma', {...options, discover: async () => {fetched = true; return [pick]}})
  assert.equal(result.outcome, 'already_recorded'); assert.equal(fetched, false)
  db.save({...discoveries(db)[0], status: 'rejected'})
  await runWatch(db.client, 'gma', {...options, discover: async () => [pick, {...pick, title: 'Different Book'}]})
  assert.equal(discoveries(db).length, 2)
  assert.equal(discoveries(db).filter((d) => d.status === 'rejected').length, 1)
})

test('each invocation records skipped/no-change/failed outcomes and no source access outside window', async () => {
  const db = database()
  const outside = await runWatch(db.client, 'read-with-jenna', {...options, now: new Date('2026-10-12T14:00:00Z'), discover: async () => {throw new Error('Should not fetch')}})
  assert.equal(outside.outcome, 'skipped')
  assert.equal((await runWatch(db.client, 'gma', {...options, discover: async () => []})).outcome, 'no_change')
  assert.equal((await runWatch(db.client, 'gma', {...options, discover: async () => {throw new Error('Secret')}})).outcome, 'failed')
  assert.equal([...db.docs.values()].filter((d) => d._type === 'bookClubWatchRun').length, 3)
})

test('approval publishes exactly once under concurrent events; history and editorial metadata survive', async () => {
  const db = database([collection, {_id: 'existing-book', _type: 'book', title: pick.title, authors: pick.authors, description: 'Editorial description'}])
  await runWatch(db.client, 'gma', options)
  const doc = discoveries(db)[0]; approve(db, doc)
  await Promise.all([publishDiscovery(db.client, doc._id), publishDiscovery(db.client, doc._id)])
  const books = db.docs.get(collection._id)?.books as {book: {_ref: string}; selectionNumber: number}[]
  assert.equal(books.length, 2); assert.equal(books[1].selectionNumber, 9)
  assert.equal(books[1].book._ref, 'existing-book')
  assert.equal(db.docs.get('existing-book')?.description, 'Editorial description')
  assert.equal(db.docs.get(doc._id)?.status, 'published')
  await publishDiscovery(db.client, doc._id)
  assert.equal((db.docs.get(collection._id)?.books as unknown[]).length, 2)
})

test('partial publication retry reuses the created book and preserves approval snapshot', async () => {
  const db = database([collection]); await runWatch(db.client, 'gma', options)
  const doc = discoveries(db)[0]; approve(db, doc)
  db.save({...db.docs.get(doc._id), reviewedTitle: 'Unapproved later edit'})
  db.failPublication(true)
  await assert.rejects(publishDiscovery(db.client, doc._id))
  assert.equal(db.docs.get(doc._id)?.status, 'approved')
  assert.ok(db.docs.get(doc._id)?.processingError)
  assert.equal([...db.docs.values()].filter((d) => d._type === 'book').length, 1)
  db.failPublication(false); await publishDiscovery(db.client, doc._id)
  const books = [...db.docs.values()].filter((d) => d._type === 'book')
  assert.equal(books.length, 1); assert.equal(books[0].title, pick.title)
  assert.equal(db.docs.get(doc._id)?.status, 'published')
})

test('invalid approval is blocked, and errors never expose arbitrary provider messages', () => {
  assert.throws(() => approvalFor({discoveredTitle: 'Book', discoveredAuthors: ['Author'], selectionMonth: '2026-10'} as Discovery), /Choose/)
  assert.doesNotMatch(safeError(new Error('token=secret')), /secret/)
})
