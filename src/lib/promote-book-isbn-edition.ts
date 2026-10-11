import {createHash} from 'node:crypto'
import type {SanityClient} from '@sanity/client'
import {catalogWorkKey} from './catalog-book-match'
import {isbn13For, type EditionInput, type EditionMetadata} from './edition-metadata'
import {isbn10For, normalizeIsbn} from './isbn'

export type BookIsbnRecord = {
  _id: string
  title: string
  authors?: string[] | null
  isbn13?: string | null
  isbn10?: string | null
}

export type IsbnEditionRecord = {
  _id: string
  bookId?: string
  editorialLocked?: boolean
}

export type PromoteAction = 'create' | 'refresh' | 'conflict' | 'locked' | 'invalid'

export type PromoteResult = {
  action: PromoteAction
  bookId: string
  title: string
  isbn13?: string
  editionId?: string
  titleMismatch?: boolean
  fields: Record<string, unknown>
  reason?: string
}

const fresh = {cache: 'no-store' as const}

export function isbnForBook(book: BookIsbnRecord) {
  const isbn13 = book.isbn13?.trim()
  const isbn10 = book.isbn10?.trim()
  return (isbn13 && normalizeIsbn(isbn13)) || (isbn10 && normalizeIsbn(isbn10)) || undefined
}

export function editionFieldsFromMetadata(bookTitle: string, isbn13: string, metadata: EditionMetadata) {
  const now = new Date().toISOString()
  const fields: Record<string, unknown> = {
    isbn13: metadata.isbn13 || isbn13,
    title: metadata.title || bookTitle,
    metadataCheckedAt: now,
  }
  if (metadata.isbn10) fields.isbn10 = metadata.isbn10
  else {
    const isbn10 = isbn10For(String(fields.isbn13))
    if (isbn10) fields.isbn10 = isbn10
  }
  if (metadata.googleBooksId) fields.googleBooksId = metadata.googleBooksId
  if (metadata.publisher) fields.publisher = metadata.publisher
  if (metadata.publicationDate) fields.publicationDate = metadata.publicationDate
  if (metadata.pageCount) fields.pageCount = metadata.pageCount
  if (metadata.language) fields.language = metadata.language
  if (metadata.format) fields.format = metadata.format
  if (metadata.translators?.length) fields.translators = metadata.translators
  if (metadata.editionStatement) fields.editionStatement = metadata.editionStatement
  if (metadata.openLibraryEditionKey) fields.openLibraryEditionKey = metadata.openLibraryEditionKey
  if (metadata.cover) {
    fields.cover = metadata.cover
    fields.needsCover = false
    fields.coverCheckedAt = now
  } else {
    fields.needsCover = true
    fields.coverCheckedAt = now
  }
  return fields
}

function titlesMatch(book: BookIsbnRecord, metadata: EditionMetadata) {
  if (!metadata.title || !metadata.authors?.length || !book.authors?.length) return !metadata.title
  return metadata.authors.some((author) =>
    book.authors!.some((name) => catalogWorkKey(metadata.title!, author) === catalogWorkKey(book.title, name)),
  )
}

export {editionTitleAuthorMismatch} from './edition-title-mismatch'

export async function promoteBookIsbnEdition(
  client: SanityClient,
  book: BookIsbnRecord,
  options: {
    apply?: boolean
    resolve?: (input: EditionInput) => Promise<EditionMetadata>
    existing?: IsbnEditionRecord | null
  } = {},
): Promise<PromoteResult> {
  const isbn13 = isbnForBook(book)
  if (!isbn13) {
    return {action: 'invalid', bookId: book._id, title: book.title, fields: {}, reason: 'Book has no valid ISBN'}
  }
  const existing = options.existing !== undefined ? options.existing : await client.fetch<IsbnEditionRecord | null>(
    `*[_type == "edition" && !(_id in path("drafts.**")) && (isbn13 == $isbn || ($isbn10 != "" && isbn10 == $isbn10))][0]{_id, "bookId": book._ref, editorialLocked}`,
    {isbn: isbn13, isbn10: isbn10For(isbn13) || ''},
    fresh,
  )
  if (existing?.bookId && existing.bookId !== book._id) {
    return {action: 'conflict', bookId: book._id, title: book.title, isbn13, editionId: existing._id, fields: {}, reason: 'ISBN already belongs to another book'}
  }
  if (existing?.editorialLocked) {
    return {action: 'locked', bookId: book._id, title: book.title, isbn13, editionId: existing._id, fields: {}, reason: 'Edition is editorially locked'}
  }

  const resolve = options.resolve
  if (!resolve) throw new Error('A metadata resolver is required.')
  const metadata = await resolve({title: book.title, author: book.authors?.[0] || '', isbn13, isbn10: book.isbn10 || isbn10For(isbn13)})
  if (metadata.isbn13 && metadata.isbn13 !== isbn13 && normalizeIsbn(metadata.isbn13) !== isbn13) {
    return {action: 'invalid', bookId: book._id, title: book.title, isbn13, fields: {}, reason: 'Provider returned a different ISBN'}
  }
  const fields = editionFieldsFromMetadata(book.title, isbn13, metadata)
  const titleMismatch = Boolean(metadata.title && book.authors?.length && !titlesMatch(book, metadata))
  fields.providerTitleMismatch = titleMismatch
  if (metadata.title) fields.providerTitle = metadata.title
  if (metadata.authors?.length) fields.providerAuthors = metadata.authors
  const apply = options.apply === true

  if (existing) {
    if (apply) {
      await client.patch(existing._id).set(fields).commit({visibility: 'sync'})
    }
    return {action: 'refresh', bookId: book._id, title: book.title, isbn13, editionId: existing._id, titleMismatch, fields}
  }

  const importKey = createHash('sha256').update(isbn13).digest('hex')
  if (!apply) {
    return {action: 'create', bookId: book._id, title: book.title, isbn13, titleMismatch, fields}
  }
  try {
    await client.transaction()
      .create({_id: `editionImportIdentity.${importKey}`, _type: 'catalogImportIdentity', importKey})
      .create({
        _type: 'edition',
        importKey,
        book: {_type: 'reference', _ref: book._id},
        ...fields,
      })
      .commit({visibility: 'sync'})
    const editionId = await client.fetch<string | null>(
      `*[_type == "edition" && isbn13 == $isbn && book._ref == $bookId && !(_id in path("drafts.**"))][0]._id`,
      {isbn: isbn13, bookId: book._id},
      fresh,
    ) || undefined
    return {action: 'create', bookId: book._id, title: book.title, isbn13, editionId, titleMismatch, fields}
  } catch (error) {
    const conflict = error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409
    const dropped = error && typeof error === 'object' && 'code' in error && ['ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(String((error as {code?: string}).code))
    if (!conflict && !dropped) throw error
    const recovered = await client.fetch<IsbnEditionRecord | null>(
      `*[_type == "edition" && !(_id in path("drafts.**")) && isbn13 == $isbn][0]{_id, "bookId": book._ref, editorialLocked}`,
      {isbn: isbn13},
      fresh,
    )
    if (dropped && !recovered) throw error
    if (recovered?.bookId && recovered.bookId !== book._id) {
      return {action: 'conflict', bookId: book._id, title: book.title, isbn13, editionId: recovered._id, fields: {}, reason: 'ISBN already belongs to another book'}
    }
    if (recovered && apply) await client.patch(recovered._id).set(fields).commit({visibility: 'sync'})
    return {action: recovered ? 'refresh' : 'create', bookId: book._id, title: book.title, isbn13, editionId: recovered?._id, titleMismatch, fields}
  }
}
