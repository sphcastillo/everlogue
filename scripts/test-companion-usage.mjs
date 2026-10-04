import assert from 'node:assert/strict'
import {config} from 'dotenv'
import {createClient} from '@sanity/client'

config({path: '.env.local', quiet: true})
const client = createClient({projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET, apiVersion: '2026-02-01', useCdn: false, token: process.env.SANITY_API_READ_TOKEN})
const endpoint = new URL('/api/companion', process.argv[2] || 'http://localhost:3000')
for (const message of ['Recommend something hopeful about friendship.', 'Who wrote The Christie Affair, and what does Everlogue say about it?']) {
  const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({message}), signal: AbortSignal.timeout(115000)})
  assert.equal(response.status, 200, await (response.status !== 200 ? response.text() : Promise.resolve('')))
  const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line))
  assert.equal(events.at(-1).type, 'done', JSON.stringify(events))
  const id = response.headers.get('X-Companion-Request-Id')
  assert.ok(id)
  const usage = await client.getDocument(id)
  assert.equal(usage.status, 'completed')
  assert.equal(usage.model, 'gpt-5.4-mini')
  assert.ok(usage.inputTokens > 0)
  assert.ok(usage.outputTokens > 0)
  assert.ok(usage.estimatedUsd > 0)
  assert.equal(usage.usageIncomplete, false)
  assert.ok(usage.modelCalls >= 2 && usage.modelCalls <= 6)
  assert.equal(usage.inputTokens, usage.stages.reduce((total, step) => total + step.inputTokens, 0))
  const answer = events.filter(event => event.type === 'text').map(event => event.text).join('')
  if (message.startsWith('Recommend')) {
    assert.ok(events.some(event => event.tool === 'search_catalog'))
    assert.match(answer, /1\./)
    assert.match(answer, /3\./)
  } else {
    assert.ok(events.some(event => event.tool === 'initial_context'))
    assert.match(answer, /Nina de Gramont/i)
  }
  console.log(JSON.stringify({id, model: usage.model, calls: usage.modelCalls, inputTokens: usage.inputTokens, cachedInputTokens: usage.cachedInputTokens, outputTokens: usage.outputTokens, estimatedUsd: usage.estimatedUsd, tools: events.filter(event => event.type === 'retrieval').map(event => event.tool)}))
}
