import assert from 'node:assert/strict'
const endpoint = new URL('/api/companion', process.argv[2] || 'http://localhost:3000')
async function ask(message, history = []) {
  const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({message, history}), signal: AbortSignal.timeout(115000)})
  assert.equal(response.status, 200)
  const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line))
  assert.equal(events.at(-1).type, 'done', JSON.stringify(events))
  assert.equal(events.some(event => event.type === 'error'), false)
  return {answer: events.filter(e => e.type === 'text').map(e => e.text).join(''), tools: events.filter(e => e.type === 'retrieval').map(e => e.tool)}
}

function assertRecommendations(result) {
  assert.ok(result.tools.includes('search_catalog'), 'Recommendations must search the full catalog')
  const books = [...result.answer.matchAll(/(?:^|\n)\s*[123][.)]\s+([^\n]+?)\s+(?:—| - )\s+([^\n]+)/g)]
  assert.equal(books.length, 3, 'Response must contain three numbered title-and-author recommendations')
  assert.doesNotMatch(result.answer, /\b\d+\s+pages?\b/i, 'Recommendations must not mention page counts')
  assert.doesNotMatch(
    result.answer,
    /(?:verified )?catalog (?:matches|results|limitations)|adjacent genres|insufficient metadata|missing fields?|search diagnostics?|allow series|standalone-only/i,
    'Recommendations must not expose diagnostics or invented requirements',
  )
  return books.map(match => match[1].trim())
}

const question = 'What should I read next?'
const opening = await ask(question)
assert.equal(opening.answer, 'What are you in the mood for—or what’s a book you loved and want something similar to?')
assert.equal(opening.tools.length, 0)

const request = 'I just finished a Sarah J. Maas book. I want something enchanting, immersive, and fairytale-like, but not about fairies or fae.'
const initialHistory = [{role:'user',text:question},{role:'assistant',text:opening.answer}]
const recommendation = await ask(request, initialHistory)
const [rejectedTitle] = assertRecommendations(recommendation)

const rejection = await ask(
  "The first one isn't for me. I'd rather have something more mythic and folkloric.",
  [...initialHistory, {role:'user',text:request}, {role:'assistant',text:recommendation.answer}],
)
const refinedTitles = assertRecommendations(rejection)
assert.ok(
  refinedTitles.every(title => title.toLowerCase() !== rejectedTitle.toLowerCase()),
  'A rejected recommendation must not be suggested again',
)

console.log(JSON.stringify({
  opening: opening.answer,
  recommendation: recommendation.answer,
  rejectedTitle,
  refinedRecommendation: rejection.answer,
}, null, 2))
