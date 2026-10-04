import {createHash} from 'node:crypto'
import type {SanityClient} from '@sanity/client'
import {lookupCatalogBook} from './catalog-book-match'
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
  if (!bookId) {
    try {
      bookId = (await lookupCatalogBook(client, book))?._id
    } catch {
      bookId = undefined
    }
  }
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

  if (bookId) {
    const placement = {
      _key: reader.readerId,
      _type: 'pendingImportPlacement',
      reader: reference(reader.readerId),
      readerName: reader.displayName,
      shelfStatus: book.status,
      message: snapshot.message,
      ...(book.rating !== undefined ? {rating: book.rating} : {}),
      ...(book.addedAt ? {addedAt: book.addedAt} : {}),
      ...(book.finishedAt ? {finishedAt: book.finishedAt} : {}),
      ...(book.readCount !== undefined ? {readCount: book.readCount} : {}),
    }
    await client
      .patch(bookId)
      .setIfMissing({pendingImportPlacements: []})
      .unset([`pendingImportPlacements[_key=="${reader.readerId}"]`])
      .append('pendingImportPlacements', [placement])
      .commit()
  }
}

export async function resolveCatalogImportFailure(
  client: SanityClient,
  readerId: string,
  book: Pick<GoodreadsBook, 'title' | 'author'>,
) {
  const importKey = catalogImportKey(book)
  try {
    await client
      .patch(catalogImportFailureId(readerId, book))
      .set({resolvedAt: new Date().toISOString()})
      .commit()
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) return
    throw error
  }
  const bookId = await client.fetch<string | null>(
    `*[_type == "book" && importKey == $importKey][0]._id`,
    {importKey},
    {cache: 'no-store'},
  )
  if (bookId) {
    await client.patch(bookId).unset([`pendingImportPlacements[_key=="${readerId}"]`]).commit()
  }
}
