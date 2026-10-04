import {config} from 'dotenv'
import {createClient} from '@sanity/client'

config({path: '.env.local', quiet: true})
const days = Number(process.argv[2] || 7)
if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('Provide a day count between 1 and 366.')
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01', useCdn: false, token: process.env.SANITY_API_READ_TOKEN,
})
const since = new Date(Date.now() - days * 86400000).toISOString()
async function main() {
const result = await client.fetch(`{
  "questions": count(*[_type == "companionUsage" && startedAt >= $since]),
  "completed": count(*[_type == "companionUsage" && startedAt >= $since && status == "completed"]),
  "incomplete": count(*[_type == "companionUsage" && startedAt >= $since && (usageIncomplete == true || status == "started")]),
  "modelCalls": math::sum(*[_type == "companionUsage" && startedAt >= $since].modelCalls),
  "inputTokens": math::sum(*[_type == "companionUsage" && startedAt >= $since].inputTokens),
  "cachedInputTokens": math::sum(*[_type == "companionUsage" && startedAt >= $since].cachedInputTokens),
  "outputTokens": math::sum(*[_type == "companionUsage" && startedAt >= $since].outputTokens),
  "estimatedUsd": math::sum(*[_type == "companionUsage" && startedAt >= $since].estimatedUsd)
}`, {since})
console.log(JSON.stringify({since, ...result, estimatedUsdPerQuestion: result.questions ? result.estimatedUsd / result.questions : 0}, null, 2))
}
main().catch(() => { console.error('Unable to read companion usage. Check the server environment and Sanity read access.'); process.exitCode = 1 })
