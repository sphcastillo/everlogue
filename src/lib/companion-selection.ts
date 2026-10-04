import 'server-only'
import {openai} from '@ai-sdk/openai'
import {generateObject} from 'ai'
import {z} from 'zod'
import type {CatalogMatch} from './companion-catalog'
import {compactCandidate} from './companion-context'
import {COMPANION_MODEL, type CompanionUsage} from './companion-usage'
import {RATING_GUIDANCE} from './companion-preferences'

const interpretationSchema = z.object({
  desiredExperience: z.array(z.string().min(1).max(100)).max(8),
  genreDirections: z.array(z.string().min(1).max(100)).max(8),
  explicitExclusions: z.array(z.string().min(1).max(100)).max(10),
  referenceBooks: z.array(z.object({
    title: z.string().min(1).max(200),
    role: z.enum(['context', 'positiveAnchor', 'negativeAnchor']),
  })).max(10),
  searchTerms: z.array(z.string().min(1).max(60)).min(3).max(16),
  excludeTitles: z.array(z.string().min(1).max(200)).max(40),
})

const selectionSchema = z.object({
  selections: z.array(z.object({
    bookId: z.string().min(1),
    supportedReason: z.string().min(1).max(500),
  })).max(3),
})

export type RecommendationInterpretation = z.infer<typeof interpretationSchema>
export type RecommendationSelection = {
  book: CatalogMatch
  supportedReason: string
}

type ConversationMessage = {role: 'user' | 'assistant'; text: string}

export async function interpretRecommendationRequest(
  messages: ConversationMessage[],
  abortSignal: AbortSignal,
  usage: CompanionUsage,
) {
  const {object} = await usage.measure('interpret', () => generateObject({
    model: openai(COMPANION_MODEL),
    maxOutputTokens: 1400,
    schema: interpretationSchema,
    abortSignal,
    maxRetries: 0,
    providerOptions: {openai: {store: false}},
    system: `Interpret a reader's request for an internal book-search step. Separate what they want from what they exclude.
Return desiredExperience for atmosphere, emotion, themes, and reading experience; genreDirections for broad areas worth exploring; explicitExclusions only for exclusions the reader actually stated; referenceBooks with context when a title or author merely describes recent reading, positiveAnchor only when they want something similar, and negativeAnchor when they reject it.
Do not create standalone, series, length, genre, or content requirements the reader did not state. Ratings and earlier assistant suggestions are context, not new reader requirements.
Search terms should be broad, varied catalog language spanning descriptions and genres. Include related possibilities when useful rather than requiring one exact label.
Example: "Something like a fairytale, but not about fairies. I just read Sarah J. Maas." means desiredExperience ["enchanting", "fairytale-like", "immersive"], genreDirections such as fantasy, folklore, myth, magical realism, and fairytale retellings, explicitExclusions ["books centered on fairies or fae"], and the Sarah J. Maas reference is context—not a request for more fae stories.
When the reader rejects a prior suggestion, resolve which title they mean from conversation context and add that title to excludeTitles. Never turn one rejected title into a genre ban.`,
    prompt: JSON.stringify(messages),
  }))
  return object
}

export async function selectRecommendationCandidates(
  candidates: CatalogMatch[],
  interpretation: RecommendationInterpretation,
  messages: ConversationMessage[],
  preferences: unknown,
  abortSignal: AbortSignal,
  usage: CompanionUsage,
) {
  const {object} = await usage.measure('select', () => generateObject({
    model: openai(COMPANION_MODEL),
    maxOutputTokens: 1400,
    schema: selectionSchema,
    abortSignal,
    maxRetries: 0,
    providerOptions: {openai: {store: false}},
    system: `Choose up to three distinct books from the supplied candidates. This is an internal selection step, not a reader-facing response.
The reader's current request is primary. Desired experience and genre directions are positive guidance; explicit exclusions are hard constraints. A contextual author or title reference is not a request for more of its genre or subject.
Search descriptions and genres have already been retrieved. Select by supported evidence in those fields, not by training knowledge. Descriptions and genres are sufficient; article links are not required.
${RATING_GUIDANCE}
Want to Read may break a close tie but must not override the current request. Avoid three near-identical choices. For series, prefer position 1 unless the supplied series history supports a later installment. Never require standalone status or any other property unless the reader explicitly asked for it.
supportedReason must state the specific evidence-backed connection to this request. Do not include diagnostics, counts, missing fields, verification language, page counts, or advice to relax requirements. Return only candidate IDs.`,
    prompt: JSON.stringify({
      conversation: messages,
      interpretation,
      preferences,
      candidates: candidates.map(book => compactCandidate(book, interpretation.searchTerms)),
    }),
  }))

  const candidatesById = new Map(candidates.map(book => [book._id, book]))
  const seen = new Set<string>()
  return object.selections.flatMap(selection => {
    const book = candidatesById.get(selection.bookId)
    if (!book || seen.has(book._id)) return []
    seen.add(book._id)
    return [{book, supportedReason: selection.supportedReason}]
  })
}
