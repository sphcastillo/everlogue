import type {SanityClient} from '@sanity/client'
import type {CoverSource} from '../components/BookCover'
import {editionCoverFields} from '../sanity/queries'
import {catalogWorkKey} from './catalog-book-match'
import {isbn10For, normalizeIsbn} from './isbn'
import {ensureImportEdition} from './import-edition'
import {resolveEditionMetadata, type EditionInput, type EditionMetadata} from './edition-metadata'

export type BookEdition = {
  _id: string; title?: string; isbn13?: string; isbn10?: string; publisher?: string
  publicationDate?: string; language?: string; pageCount?: number; format?: string
  translators?: string[]; editionStatement?: string; cover?: CoverSource | null
}

export const bookEditionFields = `
  _id, title, isbn13, isbn10, publisher, publicationDate, language, pageCount, format,
  translators, editionStatement, "cover": {${editionCoverFields}}
`

export async function resolveCatalogBookId(client: SanityClient, id: string) {
  const value = id.trim()
  if (!value) return null
  return client.fetch<string | null>(
    `*[_type == "book" && !(_id in path("drafts.**")) && (_id == $id || slug.current == $id)][0]._id`,
    {id: value},
    {cache: 'no-store'},
  )
}

export async function getBookEditions(client: SanityClient, bookId: string) {
  const editions = await client.fetch<BookEdition[]>(
    `*[_type == "edition" && book._ref == $bookId && !(_id in path("drafts.**"))] | order(publicationDate asc, publisher asc){${bookEditionFields}}`,
    {bookId}, {cache: 'no-store'},
  )
  // Providers also return dates such as "April 2003"; lexical order is not chronological.
  const released = (edition: BookEdition) => {
    const date = Date.parse(edition.publicationDate || '')
    return Number.isNaN(date) ? Number.MAX_SAFE_INTEGER : date
  }
  return editions.sort((a, b) => released(a) - released(b))
}

/** Discover one ISBN on demand. Never link an arbitrary ISBN to the current work. */
export async function findBookEdition(
  client: SanityClient, bookId: string, value: string,
  resolve: (input: EditionInput) => Promise<EditionMetadata> = resolveEditionMetadata,
) {
  const isbn = typeof value === 'string' && normalizeIsbn(value)
  if (!isbn) throw new Error('Enter a valid ISBN-10 or ISBN-13.')
  const existing = await client.fetch<{_id: string; bookId: string} | null>(
    `*[_type == "edition" && !(_id in path("drafts.**")) && (isbn13 == $isbn || ($isbn10 != "" && isbn10 == $isbn10))][0]{_id, "bookId": book._ref}`,
    {isbn, isbn10: isbn10For(isbn) || ''}, {cache: 'no-store'},
  )
  if (existing) {
    if (existing.bookId !== bookId) throw new Error('This ISBN is linked to another catalog book.')
  }
  const book = await client.fetch<{title: string; authors?: string[]; openLibraryWorkKey?: string; isbn13?: string} | null>(
    `*[_type == "book" && _id == $bookId && !(_id in path("drafts.**"))][0]{title, authors, openLibraryWorkKey, isbn13}`,
    {bookId}, {cache: 'no-store'},
  )
  if (!book) throw new Error('Book not found.')
  const input = {title: book.title, author: book.authors?.[0] || '', isbn13: isbn}
  if (existing) return await ensureImportEdition(client, bookId, input, resolve) || existing._id
  const metadata = await resolve(input)
  const workKey = (key?: string) => key?.split('/').pop()
  const sameWork = book.openLibraryWorkKey && metadata.openLibraryWorkKey && workKey(book.openLibraryWorkKey) === workKey(metadata.openLibraryWorkKey)
  const sameTitleAuthor = metadata.title && metadata.authors?.some((author) => book.authors?.some((name) => catalogWorkKey(metadata.title!, author) === catalogWorkKey(book.title, name)))
  if (!sameWork && !sameTitleAuthor && normalizeIsbn(book.isbn13 || '') !== isbn) {
    throw new Error('We could not verify that this ISBN belongs to this book. An editor can link the edition in the catalog.')
  }
  const id = await ensureImportEdition(client, bookId, input, async () => metadata)
  if (!id) throw new Error('This ISBN is linked to another catalog book.')
  return id
}
