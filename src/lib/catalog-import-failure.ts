import {createHash} from 'node:crypto'
import type {SanityClient} from '@sanity/client'
import type {GoodreadsBook} from './goodreads-csv'

type ImportReader = {readerId: string; displayName: string}

const reference = (_ref: string) => ({_type: 'reference', _ref})

export function catalogImportKey(book: Pick<GoodreadsBook, 'title' | 'author'>) {
  return createHash('sha256').update(`${book.title.toLowerCase()}\n${book.author.toLowerCase()}`).digest('hex')
}

export function catalogImportFailureId(readerId: string, book: Pick<GoodreadsBook, 'title' | 'author'>) {
  return `catalogImportFailure.${readerId}.${catalogImportKey(book)}`
}

function publicFailureMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message.slice(0, 500)
    : 'Could not save this book.'
}

export async function reportCatalogImportFailure(
  client: SanityClient,
  reader: ImportReader,
  book: GoodreadsBook,
  error: unknown,
  bookId?: string,
) {
  const now = new Date().toISOString()
  const _id = catalogImportFailureId(reader.readerId, book)
  const snapshot = {
    reader: reference(reader.readerId),
    readerName: reader.displayName,
    title: book.title,
    author: book.author,
    shelfStatus: book.status,
    csvRow: book.row,
    importKey: catalogImportKey(book),
    message: publicFailureMessage(error),
    lastFailedAt: now,
    ...(bookId ? {book: reference(bookId)} : {}),
    ...(book.isbn10 ? {isbn10: book.isbn10} : {}),
    ...(book.isbn13 ? {isbn13: book.isbn13} : {}),
    ...(book.goodreadsId ? {goodreadsId: book.goodreadsId} : {}),
    ...(book.rating !== undefined ? {rating: book.rating} : {}),
    ...(book.addedAt ? {addedAt: book.addedAt} : {}),
    ...(book.finishedAt ? {finishedAt: book.finishedAt} : {}),
    ...(book.readCount !== undefined ? {readCount: book.readCount} : {}),
    ...(book.publicationYear ? {publicationYear: book.publicationYear} : {}),
  }

  await client.createIfNotExists({
    _id,
    _type: 'catalogImportFailure',
    retryCount: 0,
    failedAt: now,
    ...snapshot,
  })
  await client
    .patch(_id)
    .set(snapshot)
    .inc({retryCount: 1})
    .unset(['resolvedAt'])
    .commit()
}

export async function resolveCatalogImportFailure(
  client: SanityClient,
  readerId: string,
  book: Pick<GoodreadsBook, 'title' | 'author'>,
) {
  try {
    await client
      .patch(catalogImportFailureId(readerId, book))
      .set({resolvedAt: new Date().toISOString()})
      .commit()
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) return
    throw error
  }
}
