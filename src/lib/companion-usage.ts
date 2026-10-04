import {createHmac} from 'node:crypto'
import type {SanityClient} from '@sanity/client'
import type {LanguageModelUsage} from 'ai'

export const COMPANION_MODEL = 'gpt-5.4-mini'
export type UsageStage = 'interpret' | 'select' | 'write' | 'clarify' | 'context'
export type UsageOutcome = 'completed' | 'failed' | 'cancelled'

export class CompanionLimitError extends Error {
  constructor(message: string, public retryAfter: number) { super(message) }
}

function limit(name: string, fallback: number) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${name}`)
  return parsed
}

// Pricing snapshot: 2026-10-04, standard text API. This is an estimate, not billing.
// https://developers.openai.com/api/docs/models/gpt-5.4-mini
export function usageNumbers(usage: Partial<LanguageModelUsage>) {
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const cachedInputTokens = Math.min(inputTokens, usage.inputTokenDetails?.cacheReadTokens ?? 0)
  return {
    inputTokens, cachedInputTokens, outputTokens,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
    estimatedUsd: ((inputTokens - cachedInputTokens) * 0.75 + cachedInputTokens * 0.075 + outputTokens * 4.5) / 1_000_000,
    usageMissing: usage.inputTokens === undefined || usage.outputTokens === undefined,
  }
}

type Counter = {_id: string; _rev: string; count: number; lastStartedAt?: number}

/** Atomic admission across all app instances. Counters are daily singleton guards.
 * Guests deliberately share a pool: resetting cookies cannot bypass this limit.
 * Never store reader IDs, IP addresses, prompts, reviews, answers, or tool payloads.
 */
export async function reserveCompanionUsage(client: SanityClient, readerId: string | null, secret: string, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10)
  const resetAt = Date.parse(`${day}T00:00:00Z`) + 86_400_000
  const subject = readerId ? createHmac('sha256', secret).update(`${day}:${readerId}`).digest('hex') : 'guests'
  const ids = [`companionQuota.${day}.global`, `companionQuota.${day}.${subject}`]
  const limits = [limit('COMPANION_DAILY_LIMIT', 200), readerId ? limit('COMPANION_READER_DAILY_LIMIT', 20) : limit('COMPANION_GUEST_DAILY_LIMIT', 30)]
  const startedAt = new Date(now).toISOString()
  for (let attempt = 0; attempt < 5; attempt++) {
    // Document API reads the authoritative document store; no GROQ search-index lag.
    const counters = await client.getDocuments<Counter>(ids)
    for (let index = 0; index < ids.length; index++) {
      if ((counters[index]?.count ?? 0) >= limits[index]) {
        throw new CompanionLimitError(index === 0
          ? "The companion has reached today's limit. Please come back tomorrow."
          : readerId ? "You've reached today's companion limit. Please come back tomorrow."
            : "Today's guest allowance is used up. Sign in to use your personal allowance.", Math.ceil((resetAt - now) / 1000))
      }
    }
    if (readerId && now - (counters[1]?.lastStartedAt ?? 0) < 10_000) {
      throw new CompanionLimitError('Please wait a few seconds before asking again.', Math.ceil((10_000 - now + counters[1]!.lastStartedAt!) / 1000))
    }
    let transaction = client.transaction()
    for (let index = 0; index < ids.length; index++) {
      const counter = counters[index]
      transaction = counter
        ? transaction.patch(counter._id, patch => patch.ifRevisionId(counter._rev).inc({count: 1}).set({lastStartedAt: now}))
        : transaction.create({_id: ids[index], _type: 'companionQuota', day, count: 1, lastStartedAt: now})
    }
    transaction = transaction.create({_type: 'companionUsage', model: COMPANION_MODEL, startedAt, status: 'started', audience: readerId ? 'reader' : 'guest'})
    try {
      const result = await transaction.commit({visibility: 'sync', returnDocuments: false})
      const usageId = result.results[2].id
      return new CompanionUsage(client, usageId, now)
    } catch (error) {
      if (!(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409)) throw error
    }
  }
  throw new CompanionLimitError('The companion is busy. Please try again shortly.', 10)
}

export class CompanionUsage {
  private stages: Array<ReturnType<typeof usageNumbers> & {stage: UsageStage; _key: string}> = []
  private finished = false
  private failed = false
  private callsStarted = 0
  constructor(private client: SanityClient, readonly id: string, private started: number) {}

  record(stage: UsageStage, usage: Partial<LanguageModelUsage>) {
    this.stages.push({...usageNumbers(usage), stage, _key: String(this.stages.length)})
  }

  async measure<T extends {usage: LanguageModelUsage}>(stage: UsageStage, operation: () => Promise<T>): Promise<T> {
    this.startCall()
    try {
      const result = await operation()
      this.record(stage, result.usage)
      return result
    } catch (error) {
      const usage = error && typeof error === 'object' && 'usage' in error ? error.usage : undefined
      this.record(stage, (usage ?? {}) as Partial<LanguageModelUsage>)
      this.failed = true
      throw error
    }
  }

  markFailed() { this.failed = true }
  startCall() { this.callsStarted++ }

  async finish(outcome: UsageOutcome) {
    if (this.finished) return
    this.finished = true
    const totals = this.stages.reduce((sum, step) => ({
      inputTokens: sum.inputTokens + step.inputTokens,
      cachedInputTokens: sum.cachedInputTokens + step.cachedInputTokens,
      outputTokens: sum.outputTokens + step.outputTokens,
      reasoningTokens: sum.reasoningTokens + step.reasoningTokens,
      estimatedUsd: sum.estimatedUsd + step.estimatedUsd,
    }), {inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, estimatedUsd: 0})
    const summary = {...totals, status: this.failed && outcome === 'completed' ? 'failed' : outcome,
      finishedAt: new Date().toISOString(), durationMs: Date.now() - this.started,
      modelCalls: Math.max(this.callsStarted, this.stages.length), usageIncomplete: outcome !== 'completed' || this.failed || this.stages.some(step => step.usageMissing),
    }
    console.info('companion_usage', JSON.stringify({id: this.id, model: COMPANION_MODEL, ...summary}))
    try { await this.client.patch(this.id).set({...summary, stages: this.stages}).commit() }
    catch { console.error('companion_usage_persistence_failed', {id: this.id}) }
  }
}
