import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {SanityClient} from '@sanity/client'
import {CompanionLimitError, CompanionUsage, reserveCompanionUsage, usageNumbers} from '../src/lib/companion-usage'
import {compactCandidate, compactPreferences, relevantExcerpt} from '../src/lib/companion-context'

// In-memory document store emulates atomic revision checks, not a search index.
function store() {
  type Doc = Record<string, unknown> & {_id: string; _rev: string}
  const docs = new Map<string, Doc>()
  let revision = 0
  let id = 0
  let unavailable = false
  const client = {
    getDocuments: async (ids: string[]) => ids.map(id => structuredClone(docs.get(id) ?? null)),
    transaction() {
      const mutations: Array<{doc?: Record<string, unknown>; id?: string; rev?: string; increment?: number; values?: Record<string, unknown>}> = []
      const transaction = {
        create(doc: Record<string, unknown>) { mutations.push({doc}); return transaction },
        patch(id: string, callback: (patch: unknown) => unknown) {
          const mutation: typeof mutations[number] = {id}
          const patch = {
            ifRevisionId(rev: string) { mutation.rev = rev; return patch },
            inc({count}: {count: number}) { mutation.increment = count; return patch },
            set(values: Record<string, unknown>) { mutation.values = values; return patch },
          }
          callback(patch); mutations.push(mutation); return transaction
        },
        async commit() {
          if (unavailable) throw new Error('Unavailable')
          for (const m of mutations) {
            if ((m.doc?._id && docs.has(String(m.doc._id))) || (m.id && docs.get(m.id)?._rev !== m.rev)) throw {statusCode: 409}
          }
          const results = mutations.map(m => {
            const key = m.id ?? String(m.doc?._id ?? `sanity-generated-${++id}`)
            const old = docs.get(key)
            docs.set(key, {...old, ...m.doc, ...m.values, ...(m.increment ? {count: Number(old?.count ?? 0) + m.increment} : {}), _id: key, _rev: String(++revision)})
            return {id: key}
          })
          return {results}
        },
      }
      return transaction
    },
    patch(id: string) {
      return {set: (values: Record<string, unknown>) => ({commit: async () => {
        docs.set(id, {...docs.get(id)!, ...values})
      }})}
    },
  }
  return {client: client as unknown as SanityClient, docs, fail: () => { unavailable = true }}
}

test('cached tokens get discounted; reasoning is not charged twice', () => {
  const usage = usageNumbers({inputTokens: 1000, outputTokens: 100, inputTokenDetails: {cacheReadTokens: 800, noCacheTokens: 200, cacheWriteTokens: 0}, outputTokenDetails: {reasoningTokens: 40, textTokens: 60}})
  assert.equal(usage.estimatedUsd, 0.00066)
  assert.equal(usage.reasoningTokens, 40)
  assert.equal(usage.usageMissing, false)
  assert.equal(usageNumbers({}).usageMissing, true)
})

test('concurrent first requests cannot exceed the global quota or create orphan usage records', async () => {
  process.env.COMPANION_DAILY_LIMIT = '1'
  try {
    const db = store()
    const results = await Promise.allSettled(['reader-a', 'reader-b'].map(id => reserveCompanionUsage(db.client, id, 'test-secret')))
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal(results.filter(r => r.status === 'rejected' && r.reason instanceof CompanionLimitError).length, 1)
    assert.equal([...db.docs.values()].filter(d => d._type === 'companionUsage').length, 1)
    assert.equal([...db.docs.values()].filter(d => d._type === 'companionQuota').every(d => d.count === 1), true)
    assert.ok(!JSON.stringify([...db.docs.values()]).includes('reader-a'))
  } finally { delete process.env.COMPANION_DAILY_LIMIT }
})

test('per-reader allowance, cooldown, shared guest pool, and UTC rollover', async () => {
  process.env.COMPANION_READER_DAILY_LIMIT = '2'
  process.env.COMPANION_GUEST_DAILY_LIMIT = '1'
  try {
    const db = store()
    const now = Date.parse('2026-10-04T23:59:00Z')
    await reserveCompanionUsage(db.client, 'reader', 'secret', now)
    await assert.rejects(reserveCompanionUsage(db.client, 'reader', 'secret', now + 1), CompanionLimitError)
    await reserveCompanionUsage(db.client, 'reader', 'secret', now + 11000)
    await assert.rejects(reserveCompanionUsage(db.client, 'reader', 'secret', now + 22000), CompanionLimitError)
    await reserveCompanionUsage(db.client, null, 'secret', now)
    await assert.rejects(reserveCompanionUsage(db.client, null, 'secret', now), CompanionLimitError)
    await reserveCompanionUsage(db.client, 'other-reader', 'secret', now)
    await reserveCompanionUsage(db.client, 'reader', 'secret', now + 60000)
  } finally { delete process.env.COMPANION_READER_DAILY_LIMIT; delete process.env.COMPANION_GUEST_DAILY_LIMIT }
})

test('disabled, invalid configuration and storage failures never admit requests', async () => {
  const db = store()
  process.env.COMPANION_DAILY_LIMIT = '0'
  try { await assert.rejects(reserveCompanionUsage(db.client, null, 'secret'), CompanionLimitError) }
  finally { delete process.env.COMPANION_DAILY_LIMIT }
  process.env.COMPANION_DAILY_LIMIT = 'bad'
  try { await assert.rejects(reserveCompanionUsage(db.client, null, 'secret'), /Invalid/) }
  finally { delete process.env.COMPANION_DAILY_LIMIT }
  db.fail()
  await assert.rejects(reserveCompanionUsage(db.client, null, 'secret'), /Unavailable/)
  assert.equal(db.docs.size, 0)
})

test('stage totals are persisted once, including failed and cancelled partial usage', async () => {
  const db = store()
  const usage = await reserveCompanionUsage(db.client, null, 'secret')
  usage.record('interpret', {inputTokens: 100, outputTokens: 20})
  await assert.rejects(usage.measure('select', async () => { throw {usage: {inputTokens: 200, outputTokens: 10}} }))
  await usage.finish('failed')
  await usage.finish('completed')
  const doc = db.docs.get(usage.id)!
  assert.equal(doc.inputTokens, 300)
  assert.equal(doc.outputTokens, 30)
  assert.equal(doc.modelCalls, 2)
  assert.equal(doc.status, 'failed')
  assert.equal(doc.usageIncomplete, true)
  const cancelled = new CompanionUsage(db.client, usage.id, Date.now())
  await cancelled.finish('cancelled')
  assert.equal(db.docs.get(usage.id)!.status, 'cancelled')
})

test('context selection preserves relevant source evidence, ratings and series fields with bounded excerpts', () => {
  const description = 'Unrelated introductory sentence. '.repeat(100) + 'A hopeful story about friendship.'
  const excerpt = relevantExcerpt(description, ['hopeful', 'friendship'], 100)!
  assert.ok(excerpt.includes('A hopeful story about friendship.'))
  assert.ok(excerpt.length <= 100)
  const candidate = compactCandidate({_id: 'book', title: 'Book', description, onWantToRead: true, series: {position: 2}, earlierSeriesPositionsRead: [1]}, ['friendship'])
  assert.equal(candidate.onWantToRead, true)
  assert.deepEqual(candidate.earlierSeriesPositionsRead, [1])
  assert.ok(candidate.description!.length <= 900)
  const preferences = compactPreferences({status: 'available', ratings: Array.from({length: 80}, (_, i) => ({value: 2, book: {title: `Book ${i}`, description}})), reviews: Array.from({length: 40}, () => ({body: description, rating: 2}))}, ['friendship'])
  assert.equal(preferences.ratings.length, 10)
  assert.equal(preferences.reviews.length, 4)
  assert.equal(preferences.ratings[0].value, 2)
  assert.ok(preferences.reviews[0].body!.length <= 650)
})
