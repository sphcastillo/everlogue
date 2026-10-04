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

export function findMatchingCatalogBook(request: CatalogMatchRequest, books: CatalogMatchCandidate[]) {
  const requestKey = catalogWorkKey(request.title, request.author)
  for (const book of books) {
    if (request.goodreadsId && book.goodreadsBookId === request.goodreadsId) return book
    if (request.isbn13 && book.isbn13 === request.isbn13) return book
    if (request.isbn10 && book.isbn10 === request.isbn10) return book
    const authors = (book.authors ?? []).filter((author): author is string => Boolean(author?.trim()))
    if (!book.title?.trim()) continue
    if (!authors.length && catalogWorkTitle(book.title) === catalogWorkTitle(request.title)) return book
    for (const author of authors) {
      if (catalogWorkKey(book.title, author) === requestKey) return book
    }
  }
  return null
}

export async function lookupCatalogBook(client: SanityClient, request: CatalogMatchRequest) {
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
  return findMatchingCatalogBook(request, candidates || [])
}
