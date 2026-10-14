import type {SanityClient} from '@sanity/client'

export type CatalogMatchRequest = {
  title: string
  author: string
  isbn10?: string
  isbn13?: string
  goodreadsId?: string
}

export type CatalogMatchCandidate = {
  _id: string
  title?: string | null
  authors?: (string | null)[] | null
  isbn10?: string | null
  isbn13?: string | null
  goodreadsBookId?: string | null
}

export function catalogNameKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/['’ʻ`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function catalogWorkTitle(title: string) {
  return catalogNameKey(title.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/g, ''))
}

export function catalogWorkKey(title: string, author?: string | null) {
  const work = catalogWorkTitle(title)
  const who = author?.trim() ? catalogNameKey(author) : ''
  return who ? `${work}|${who}` : `title:${work}`
}

export type CatalogMatchResult =
  | {kind: 'match'; book: CatalogMatchCandidate}
  | {kind: 'ambiguous'; books: CatalogMatchCandidate[]}
  | {kind: 'none'}

function uniqueBooks(books: CatalogMatchCandidate[]) {
  const seen = new Set<string>()
  return books.filter((book) => {
    if (seen.has(book._id)) return false
    seen.add(book._id)
    return true
  })
}

export function classifyCatalogMatch(request: CatalogMatchRequest, books: CatalogMatchCandidate[]): CatalogMatchResult {
  const identifier = uniqueBooks(books.filter((book) =>
    (request.isbn13 && book.isbn13 === request.isbn13) ||
    (request.isbn10 && book.isbn10 === request.isbn10) ||
    (request.goodreadsId && book.goodreadsBookId === request.goodreadsId)))
  if (identifier.length === 1) return {kind: 'match', book: identifier[0]}
  if (identifier.length > 1) return {kind: 'ambiguous', books: identifier}

  const requestKey = catalogWorkKey(request.title, request.author)
  const titled = uniqueBooks(books.filter((book) => {
    if (!book.title?.trim()) return false
    const authors = (book.authors ?? []).filter((author): author is string => Boolean(author?.trim()))
    if (!authors.length) return catalogWorkTitle(book.title) === catalogWorkTitle(request.title)
    return authors.some((author) => catalogWorkKey(book.title!, author) === requestKey)
  }))
  if (titled.length === 1) return {kind: 'match', book: titled[0]}
  if (titled.length > 1) return {kind: 'ambiguous', books: titled}
  return {kind: 'none'}
}

export function findMatchingCatalogBook(request: CatalogMatchRequest, books: CatalogMatchCandidate[]) {
  const result = classifyCatalogMatch(request, books)
  return result.kind === 'match' ? result.book : null
}

export async function classifyCatalogLookup(client: SanityClient, request: CatalogMatchRequest) {
  const title = request.title.toLowerCase()
  const bareTitle = catalogWorkTitle(request.title)
  const candidates = await client.fetch<CatalogMatchCandidate[]>(
    `*[_type == "book" && !(_id in path("drafts.**")) && (
      lower(title) == $title ||
      lower(title) == $bareTitle ||
      ($isbn13 != "" && isbn13 == $isbn13) ||
      ($isbn10 != "" && isbn10 == $isbn10) ||
      ($goodreadsId != "" && goodreadsBookId == $goodreadsId)
    )]{_id, title, authors, isbn10, isbn13, goodreadsBookId}`,
    {
      title,
      bareTitle,
      isbn10: request.isbn10 || '',
      isbn13: request.isbn13 || '',
      goodreadsId: request.goodreadsId || '',
    },
    {cache: 'no-store'},
  )
  return classifyCatalogMatch(request, candidates || [])
}

export async function lookupCatalogBook(client: SanityClient, request: CatalogMatchRequest) {
  const result = await classifyCatalogLookup(client, request)
  return result.kind === 'match' ? result.book : null
}
