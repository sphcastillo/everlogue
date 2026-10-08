import 'server-only'
import {defineQuery} from 'next-sanity'
import {privateClient, writeClient} from '@/sanity/client'
import type {CoverSource} from '@/lib/book-covers'
import {linkRecommendationTitles, plainRecommendationTitles} from '@/lib/companion-links'
import {stableId} from '@/lib/validation'
import {bookCoverProjection} from '../sanity/queries'

export type CompanionHistoryMessage = {
  _key?: string
  role: 'user' | 'assistant'
  text: string
  createdAt?: string
}

export type CompanionRecommendation = {
  _id: string
  title: string
  slug: string
  cover?: CoverSource | null
}

export type CompanionRecommendationGroup = {
  _key: string
  recommendedAt: string
  books: Array<CompanionRecommendation & {recommendationKey: string}>
}

export const MAX_COMPANION_HISTORY_MESSAGES = 40
export const MAX_COMPANION_MESSAGE_LENGTH = 8000

const COMPANION_HISTORY_QUERY = defineQuery(`*[
  _id == $documentId &&
  _type == "companionConversation" &&
  reader._ref == $readerId
][0]{
  "messages": coalesce(messages[]{_key, role, text, createdAt}, []),
  "updatedAt": coalesce(updatedAt, _updatedAt),
  "hiddenRecommendationIds": coalesce(hiddenRecommendationIds, [])
}`)

const LEGACY_RECOMMENDATION_BOOKS_QUERY = defineQuery(`*[
  _type == "book" &&
  title in $titles
]{
  _id,
  title,
  "slug": slug.current
}`)

const COMPANION_RECOMMENDATIONS_QUERY = defineQuery(`*[
  _type == "book" &&
  (slug.current in $routes || _id in $routes)
]{
  _id,
  title,
  "slug": coalesce(slug.current, _id),
  "cover": ${bookCoverProjection}
}`)

function documentId(readerId: string) {
  return stableId(['companionConversation', readerId])
}

type CompanionHistoryRecord = {
  messages: CompanionHistoryMessage[]
  updatedAt?: string
  hiddenRecommendationIds: string[]
}

async function loadCompanionHistory(readerId: string) {
  const record = await privateClient.fetch<CompanionHistoryRecord | null>(
    COMPANION_HISTORY_QUERY,
    {documentId: documentId(readerId), readerId},
    {cache: 'no-store'},
  )
  const messages = (record?.messages || []).map(message => ({
    ...message,
    createdAt: message.createdAt || record?.updatedAt,
  }))
  const titles = [...new Set(messages.flatMap(message =>
    message.role === 'assistant' ? plainRecommendationTitles(message.text) : [],
  ))]
  if (!titles.length) {
    return {
      messages,
      hiddenRecommendationIds: record?.hiddenRecommendationIds || [],
    }
  }

  const legacyBooks = await privateClient.fetch<{_id: string; title: string; slug?: string}[]>(
    LEGACY_RECOMMENDATION_BOOKS_QUERY, {titles}, {cache: 'no-store'},
  )
  const linkedMessages = messages.map(message => {
    if (message.role !== 'assistant') return message
    const selections = legacyBooks
      .filter(book => message.text.includes(book.title))
      .map(book => ({book}))
    return selections.length
      ? {...message, text: linkRecommendationTitles(message.text, selections)}
      : message
  })
  return {
    messages: linkedMessages,
    hiddenRecommendationIds: record?.hiddenRecommendationIds || [],
  }
}

export async function getCompanionHistory(readerId: string) {
  return (await loadCompanionHistory(readerId)).messages
}

function recommendationRoutes(text: string) {
  return [...new Set(
    [...text.matchAll(/\]\(\/books\/([A-Za-z0-9._~%+-]+)\)/g)].map(match => {
      try {
        return decodeURIComponent(match[1])
      } catch {
        return match[1]
      }
    }),
  )]
}

export async function getCompanionProfileHistory(readerId: string) {
  const {messages, hiddenRecommendationIds} = await loadCompanionHistory(readerId)
  const messageRoutes = messages.map(message =>
    message.role === 'assistant' ? recommendationRoutes(message.text) : [],
  )
  const routes = [...new Set(messageRoutes.flat())]
  if (!routes.length) return {groups: [], hasHistory: messages.length > 0}

  const books = await privateClient.fetch<CompanionRecommendation[]>(
    COMPANION_RECOMMENDATIONS_QUERY,
    {routes},
    {cache: 'no-store'},
  )
  const booksByRoute = new Map(
    books.flatMap(book => [[book.slug, book], [book._id, book]]),
  )
  const hidden = new Set(hiddenRecommendationIds)
  const groups = messages.flatMap((message, messageIndex) => {
    if (message.role !== 'assistant') return []
    const groupKey = message._key || `message-${messageIndex}`
    const groupBooks = messageRoutes[messageIndex].flatMap(route => {
      const book = booksByRoute.get(route)
      if (!book) return []
      const recommendationKey = `${groupKey}:${book._id}`
      return hidden.has(recommendationKey) ? [] : [{...book, recommendationKey}]
    })
    if (!groupBooks.length) return []
    return [{
      _key: groupKey,
      recommendedAt: message.createdAt || new Date(0).toISOString(),
      books: groupBooks,
    }]
  }).reverse()
  return {groups, hasHistory: messages.length > 0}
}

export async function saveCompanionHistory(
  readerId: string,
  messages: CompanionHistoryMessage[],
) {
  const history = messages.slice(-MAX_COMPANION_HISTORY_MESSAGES)
  if (history.length === 0) {
    await deleteCompanionHistory(readerId)
    return
  }

  const client = writeClient()
  const id = documentId(readerId)
  await client.createIfNotExists({
    _id: id,
    _type: 'companionConversation',
    reader: {_type: 'reference', _ref: readerId},
    messages: [],
    hiddenRecommendationIds: [],
  })
  await client.patch(id).set({
    reader: {_type: 'reference', _ref: readerId},
    messages: history.map((message, index) => ({
      _key:
        message._key && /^[A-Za-z0-9._-]+$/.test(message._key)
          ? message._key
          : stableId([message.createdAt || String(index), message.role]),
      _type: 'companionMessage',
      role: message.role,
      text: message.text,
      ...(message.createdAt ? {createdAt: message.createdAt} : {}),
    })),
    updatedAt: new Date().toISOString(),
  }).commit()
}

export async function hideCompanionRecommendation(
  readerId: string,
  recommendationKey: string,
) {
  await writeClient()
    .patch(documentId(readerId))
    .setIfMissing({hiddenRecommendationIds: []})
    .append('hiddenRecommendationIds', [recommendationKey])
    .commit()
}

export async function deleteCompanionHistory(readerId: string) {
  await writeClient().delete(documentId(readerId))
}
