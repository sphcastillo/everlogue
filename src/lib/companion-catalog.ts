import type {SanityClient} from '@sanity/client'

export const MOOD_QUESTION = 'What are you in the mood for—or what’s a book you loved and want something similar to?'

export function isNextReadOpening(message: string) {
  return /^(?:what should i read next|what (?:book )?(?:should|can) i read next|recommend (?:me )?(?:a book|something to read)|help me (?:choose|find) (?:my )?next (?:book|read))[?.!\s]*$/i.test(message.trim())
}

export function hasReadingDirection(message: string) {
  if (isNextReadOpening(message)) return false
  return /\b(?:mood|something|like|similar|love|loved|enjoy|want|looking for|in the vein of|genre|fiction|nonfiction|fantasy|fairytale|fairy tale|fairies|fae|romance|mystery|thriller|horror|historical|literary|cozy|dark|hopeful|uplifting|funny|emotional|sad|friendship|family|adventure|atmosphere|without|avoid|standalone|series)\b/i.test(message)
}

export function shouldAskMoodQuestion(message: string, history: {role: string; text: string}[] = []) {
  if (!isNextReadOpening(message)) return false
  return !history.some(item => item.role === 'user' && hasReadingDirection(item.text))
}

export type CatalogMatch = {
  _id: string; title: string; authors?: string[]; description?: string; genres?: string[]
  slug?: string; onWantToRead?: boolean; isStandalone?: boolean
  series?: {name?: string; position?: number}; earlierSeriesPositionsRead?: number[]
}
const fields = `_id, title, authors, description, isStandalone, series, "slug": slug.current,
  "genres": array::unique(coalesce(genres[]->title, []) + coalesce(categories, []))`

export type RecommendationLimits = {
  maxPages?: number; excludedGenres?: string[]; excludedContent?: string[]
  standaloneOnly?: boolean; excludeTitles?: string[]
}

const SEARCH_STOP_WORDS = new Set(['about', 'books', 'book', 'fiction', 'novel', 'novels', 'something', 'stories', 'story', 'with'])

function normalizedTitle(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '')
}

function normalizedAuthors(authors: string[] | null = []) {
  return (authors || []).map(author => author.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).sort().join('|')
}

function workIdentity(book: {title: string; authors?: string[] | null}) {
  return `${normalizedTitle(book.title)}|${normalizedAuthors(book.authors)}`
}

// Reader identity comes from the authenticated server session, never from the model or browser.
export async function searchRecommendationCatalog(client: SanityClient, terms: string[], readerId: string | null, limits: RecommendationLimits = {}) {
  const patterns = [...new Set(terms.flatMap(term => {
    const phrase = term.trim().replace(/[^\p{L}\p{N}\s-]/gu, '')
    if (!phrase) return []
    const words = phrase.split(/\s+/).filter(word => word.length >= 4 && !SEARCH_STOP_WORDS.has(word.toLowerCase()))
    return [phrase, ...words]
  }))].slice(0, 16)
  if (!patterns.length) return []
  const params: Record<string, unknown> = {readerId,
    maxPages: limits.maxPages ?? null, standaloneOnly: limits.standaloneOnly ?? false,
    excludedGenres: (limits.excludedGenres || []).map(s => `*${s.toLowerCase()}*`),
    excludeTitles: (limits.excludeTitles || []).map(s => s.trim().toLowerCase()),
  }
  const expandedContentExclusions = (limits.excludedContent || []).flatMap(term =>
    /\b(?:fairies|fae)\b/i.test(term) ? ['fairies', 'fae'] : [term],
  )
  const contentExclusions = [...new Set(expandedContentExclusions)].map((term, index) => {
    params[`excludedContent${index}`] = `*${term.toLowerCase()}*`
    return `(description match $excludedContent${index} || genres match $excludedContent${index})`
  }).join(' || ') || 'false'
  const genreExclusions = (limits.excludedGenres || []).map((genre, index) => {
    params[`excludedGenre${index}`] = `*${genre.toLowerCase()}*`
    return `genres match $excludedGenre${index}`
  }).join(' || ') || 'false'
  const scores = patterns.flatMap((term, index) => {
    params[`term${index}`] = `${term}*`
    return [`select(description match $term${index} => 1, 0)`, `select(genres match $term${index} => 1, 0)`, `select(title match $term${index} => 1, 0)`]
  }).join(' + ')
  const [candidates, shelfBooks] = await Promise.all([
    client.fetch<CatalogMatch[]>(`*[
    _type == "book" && defined(title) && !(_id in path("drafts.**")) &&
    !(lower(title) in $excludeTitles) &&
    ($maxPages == null || (defined(pageCount) && pageCount > 0 && pageCount <= $maxPages)) &&
    (!$standaloneOnly || (isStandalone == true && !defined(series.name))) &&
    !(_id in *[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["finished", "currentlyReading"]].book._ref)
  ]{${fields},
    "earlierSeriesPositionsRead": *[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind == "finished" && defined(^.series.name) && book->series.name == ^.series.name].book->series.position,
    "onWantToRead": _id in *[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind == "wantToRead"].book._ref
  } [
    !(${genreExclusions}) && !(${contentExclusions})
  ] {..., "matchScore": ${scores}} [matchScore > 0] | order(matchScore desc, onWantToRead desc, title asc)[0...60]`, params, {cache: 'no-store'}),
    readerId
      ? client.fetch<{title: string; authors?: string[]}[]>(
        `*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["finished", "currentlyReading"] && defined(book->title)]{
          "title": book->title, "authors": book->authors
        }`,
        {readerId},
        {cache: 'no-store'},
      )
      : Promise.resolve([]),
  ])

  const excludedWorks = new Set(shelfBooks.map(workIdentity))
  const excludedTitlesWithoutAuthors = new Set(
    shelfBooks.filter(book => !normalizedAuthors(book.authors)).map(book => normalizedTitle(book.title)),
  )
  return candidates.filter(book =>
    !excludedWorks.has(workIdentity(book)) &&
    !excludedTitlesWithoutAuthors.has(normalizedTitle(book.title)),
  ).slice(0, 30)
}

const LOOKUP_FILLER =
  /^(can you |could you |please |hey |hi )+/i

export function extractLookupTitle(message: string) {
  const wrappedBookNoun = /\b(the|a|this)\s+(book|novel|title)(\s+(called|titled))?\s+(the|a)\b/i.test(message)
  let title = message
    .replace(LOOKUP_FILLER, '')
    .replace(/\b(find|look(?:ing)? up|search for|do you have|have you got|is there|tell me about|what about|what(?:'s| is) )\b/gi, ' ')
    .replace(/^(is|was|does)\s+/i, '')
    .replace(/\b(in (the )?(everlogue )?catalog|on (oprah'?s?|reese'?s?|jenna(?:'?s)?|gma)( book club)?|oprah'?s? book club)\b/gi, ' ')
    .replace(/[?!.,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (wrappedBookNoun) {
    title = title.replace(/^(the|a|this)\s+(book|novel|title)\s+(called|titled\s+)?/i, '').trim()
  }
  return title
}

export function isCatalogTitleLookup(message: string) {
  const text = message.trim()
  if (!text || isNextReadOpening(text) || /recommend|similar to|read next/i.test(text)) return false
  if (/\b(current(ly)? reads?|want to read|my shelves|my books|my library)\b/i.test(text)) return false
  if (/\b(how long|since when|started|founded|been running)\b/i.test(text) && /\bclub\b/i.test(text)) return false
  const title = extractLookupTitle(text)
  if (title.length < 2 || title.split(/\s+/).length > 10) return false
  return (
    /\b(find|look(?:ing)? up|do you have|is there|tell me about|search|catalog|book club|oprah|reese|jenna|gma)\b/i.test(text)
    || (!hasReadingDirection(text) && title.split(/\s+/).length <= 8)
  )
}

export type CatalogLookup = CatalogMatch & {clubs?: string[] | null}

export async function findCatalogBooks(client: SanityClient, title: string) {
  const exact = title.trim().toLowerCase()
  const fuzzy = `${title.trim()}*`
  return client.fetch<CatalogLookup[]>(
    `*[_type == "book" && !(_id in path("drafts.**")) && defined(title) && (lower(title) == $exact || title match $fuzzy)] | order(select(lower(title) == $exact => 0, 1) asc, title asc)[0...8]{
      ${fields},
      "clubs": array::unique(*[_type == "curatedCollection" && count(books[book._ref == ^._id]) > 0].title)
    }`,
    {exact, fuzzy},
    {cache: 'no-store'},
  )
}

export function catalogLookupAnswer(books: CatalogLookup[], askedTitle: string) {
  if (!books.length) return `I don’t have “${askedTitle}” in the Everlogue catalog.`
  const asked = askedTitle.toLowerCase()
  const exact = books.filter(book => book.title.toLowerCase() === asked)
  const shown = (exact.length ? exact : books).slice(0, 3)
  return shown.map(book => {
    const authors = book.authors?.filter(Boolean).join(', ') || 'Author unknown'
    const clubs = (book.clubs || []).filter(Boolean)
    const clubLine = clubs.length ? ` It’s on ${clubs.join(' and ')}.` : ''
    const blurb = book.description?.trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    const href = `/books/${encodeURIComponent(book.slug || book._id)}`
    const titleLink = `[${book.title}](${href})`
    const lead = shown.length === 1
      ? `Yes — ${titleLink} by ${authors} is in Everlogue.`
      : `${titleLink} — ${authors}`
    return `${lead}${clubLine}${blurb ? `\n${blurb}` : ''}`
  }).join('\n\n')
}

// A loved book may already be read: allow looking up its metadata as an anchor, never as a recommendation.
export async function findLovedBook(client: SanityClient, title: string) {
  return client.fetch<CatalogMatch[]>(`*[_type == "book" && !(_id in path("drafts.**")) && title match $title][0...5]{${fields}}`, {title}, {cache: 'no-store'})
}

// Preserve common explicit limits outside the model so retrying a search cannot silently relax them.
export function explicitConversationLimits(messages: {role: string; text: string}[]): RecommendationLimits {
  const limits: RecommendationLimits = {}
  for (const message of messages.filter(m => m.role === 'user')) {
    const text = message.text.toLowerCase()
    const pages = text.match(/\b(under|fewer than|less than|up to|at most)\s+(\d+)\s+pages?\b/)
    if (pages) limits.maxPages = Number(pages[2]) - (['under','fewer than','less than'].includes(pages[1]) ? 1 : 0)
    if (/\b(no page limit|any length|page count doesn.t matter)\b/.test(text)) delete limits.maxPages
    if (/\bstandalone(?:s)?(?: only)?\b/.test(text)) limits.standaloneOnly = true
    if (/\b(series (?:are|is) (?:fine|okay|ok)|not necessarily standalone)\b/.test(text)) limits.standaloneOnly = false
    const contentExclusions = [...text.matchAll(/\b(?:no|without|avoid(?:ing)?|not about)\s+([^,.!?;]+)/g)]
      .map(match => match[1].replace(/^(?:books?|stories)\s+(?:about|with)\s+/, '').trim())
      .filter(Boolean)
    if (contentExclusions.length) {
      limits.excludedContent = [...new Set([...(limits.excludedContent || []), ...contentExclusions])]
    }
    for (const genre of ['horror','romance','fantasy','thriller','mystery','science fiction','nonfiction']) {
      if (new RegExp(`\\b(?:no|avoid|without) ${genre}\\b`).test(text)) {
        limits.excludedGenres = [...new Set([...(limits.excludedGenres || []), genre])]
      }
      if (new RegExp(`\\b${genre} (?:is|are) (?:fine|okay|ok)\\b`).test(text)) {
        limits.excludedGenres = (limits.excludedGenres || []).filter(g => g !== genre)
        limits.excludedContent = (limits.excludedContent || []).filter(term => term !== genre)
      }
    }
  }
  return limits
}
export function retainSearchLimits(previous: RecommendationLimits, next: RecommendationLimits): RecommendationLimits {
  const pageLimits = [previous.maxPages, next.maxPages].filter((n): n is number => typeof n === 'number')
  return {
    ...(pageLimits.length ? {maxPages: Math.min(...pageLimits)} : {}),
    standaloneOnly: Boolean(previous.standaloneOnly || next.standaloneOnly),
    excludedGenres: [...new Set([...(previous.excludedGenres || []), ...(next.excludedGenres || [])])],
    excludedContent: [...new Set([...(previous.excludedContent || []), ...(next.excludedContent || [])])],
    excludeTitles: [...new Set([...(previous.excludeTitles || []), ...(next.excludeTitles || [])])],
  }
}
