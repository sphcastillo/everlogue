import {createHash} from 'node:crypto'
import type {SanityClient} from '@sanity/client'
import type {GoodreadsBook} from './goodreads-csv'
import {slugify, stableId} from './validation'
import {ensureImportEdition} from './import-edition'
import {isbn13For, type EditionInput, type EditionMetadata} from './edition-metadata'

const reference = (_ref: string) => ({_type: 'reference', _ref})
const isConflict = (error: unknown) => Boolean(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409)

export type ImportResult = {row: number; title: string; status: 'imported' | 'updated' | 'skipped' | 'failed'; message?: string}

async function resolveBook(client: SanityClient, book: GoodreadsBook) {
  const importKey = createHash('sha256').update(`${book.title.toLowerCase()}\n${book.author.toLowerCase()}`).digest('hex')
  const params = {importKey, goodreadsId: book.goodreadsId || '', isbn10: book.isbn10 || '', isbn13: book.isbn13 || (book.isbn10 ? isbn13For(book.isbn10) : ''), title: book.title.toLowerCase(), author: book.author.toLowerCase()}
  const query = `coalesce(
    *[_type == "book" && !(_id in path("drafts.**")) && (importKey == $importKey || (defined(goodreadsBookId) && goodreadsBookId == $goodreadsId))][0]._id,
    *[_type == "edition" && !(_id in path("drafts.**")) && (($isbn13 != "" && isbn13 == $isbn13) || ($isbn10 != "" && isbn10 == $isbn10))][0].book->_id,
    *[_type == "book" && !(_id in path("drafts.**")) && (($isbn13 != "" && isbn13 == $isbn13) || ($isbn10 != "" && isbn10 == $isbn10))][0]._id,
    *[_type == "book" && !(_id in path("drafts.**")) && lower(title) == $title && count(authors[lower(@) == $author]) > 0][0]._id
  )`
  const find = () => client.fetch<string | null>(query, params, {cache: 'no-store'})
  const existing = await find()
  if (existing) return existing

  let authorId = await client.fetch<string | null>(
    `*[_type == "author" && !(_id in path("drafts.**")) && lower(name) == $name][0]._id`,
    {name: book.author.toLowerCase()}, {cache: 'no-store'},
  )
  if (!authorId) {
    const author = await client.create({
      _type: 'author', name: book.author,
      slug: {_type: 'slug', current: `${slugify(book.author).slice(0, 70)}-${importKey.slice(0, 12)}`},
    }, {visibility: 'sync'})
    authorId = author._id
  }
  try {
    // Like the reader identity guard, this guard enforces uniqueness while Sanity
    // generates the actual book ID. Concurrent imports cannot create two books.
    await client.transaction()
      .create({_id: `catalogImportIdentity.${importKey}`, _type: 'catalogImportIdentity', importKey})
      .create({
        _type: 'book', title: book.title, importKey,
        ...(book.goodreadsId ? {goodreadsBookId: book.goodreadsId} : {}),
        slug: {_type: 'slug', current: `${slugify(book.title).slice(0, 70)}-${importKey.slice(0, 12)}`},
        authors: [book.author],
        authorReferences: [{...reference(authorId), _key: 'author'}],
        ...(book.isbn10 ? {isbn10: book.isbn10} : {}),
        ...(book.isbn13 ? {isbn13: book.isbn13} : {}),
        ...(book.publicationYear ? {firstPublicationYear: book.publicationYear} : {}),
      })
      .commit({visibility: 'sync'})
  } catch (error) {
    if (!isConflict(error)) throw error
  }
  const bookId = await find()
  if (!bookId) throw new Error('Unable to resolve the imported book.')
  return bookId
}

async function importMissingRating(client: SanityClient, readerId: string, bookId: string, value?: number) {
  if (value === undefined) return false
  const existing = await client.fetch<boolean>(
    `count(*[_type == "rating" && reader._ref == $readerId && book._ref == $bookId]) > 0`,
    {readerId, bookId}, {cache: 'no-store'},
  )
  if (!existing) {
    await client.createIfNotExists({
      _id: stableId(['rating', readerId, bookId]), _type: 'rating',
      reader: reference(readerId), book: reference(bookId), value,
    }, {visibility: 'sync'})
  }
  // Also repair stale aggregates on a retry after the rating was already saved.
  const ratings = await client.fetch<number[]>(
    `*[_type == "rating" && book._ref == $bookId].value`, {bookId}, {cache: 'no-store'},
  )
  const valid = ratings.filter((rating) => typeof rating === 'number' && rating > 0 && rating <= 5)
  await client.patch(bookId).set({ratingStats: {
    _type: 'ratingStats', count: valid.length,
    average: valid.length ? Math.round(valid.reduce((sum, rating) => sum + rating, 0) / valid.length * 100) / 100 : 0,
    updatedAt: new Date().toISOString(),
  }}).commit()
  return !existing
}

export async function importGoodreadsBook(client: SanityClient, readerId: string, book: GoodreadsBook, resolveMetadata?: (input: EditionInput) => Promise<EditionMetadata>): Promise<ImportResult> {
  const bookId = await resolveBook(client, book)
  const editionId = resolveMetadata ? await ensureImportEdition(client, bookId, book, resolveMetadata) : undefined
  const progressId = stableId(['progress', readerId, bookId])
  const existing = await client.fetch<boolean>(
    `count(*[_type == "readingProgress" && reader._ref == $readerId && book._ref == $bookId]) > 0 || count(*[_type == "shelfEntry" && book._ref == $bookId && shelf->owner._ref == $readerId && shelf->kind in ["finished", "currentlyReading", "wantToRead"]]) > 0`,
    {readerId, bookId}, {cache: 'no-store'},
  )
  if (existing) {
    if (editionId) {
      const entries = await client.fetch<{_id: string}[]>(
        `*[( _type == "readingProgress" && reader._ref == $readerId || _type == "shelfEntry" && shelf->owner._ref == $readerId) && book._ref == $bookId && !defined(edition)]{_id}`,
        {readerId, bookId}, {cache: 'no-store'},
      )
      for (const entry of entries) await client.patch(entry._id).setIfMissing({edition: reference(editionId)}).commit()
    }
    const ratingAdded = await importMissingRating(client, readerId, bookId, book.rating)
    return {row: book.row, title: book.title, status: ratingAdded ? 'updated' : 'skipped', message: ratingAdded ? 'Added your missing rating; kept your existing shelf and dates.' : 'Already in your library; kept your existing shelf, dates, and rating.'}
  }
  const shelfId = stableId(['shelf', readerId, book.status])
  try {
    // Keep progress and shelf membership atomic, using the app's existing IDs.
    const tx = client.transaction()
      .create({
        _id: progressId, _type: 'readingProgress', reader: reference(readerId), book: reference(bookId),
        status: book.status, importSource: 'goodreads',
        ...(editionId ? {edition: reference(editionId)} : {}),
        ...(book.finishedAt ? {finishedAt: book.finishedAt} : {}),
        ...(book.readCount !== undefined ? {readCount: book.readCount} : {}),
      })
      .create({
        _id: stableId(['shelfEntry', shelfId, bookId]), _type: 'shelfEntry',
        shelf: reference(shelfId), book: reference(bookId),
        ...(editionId ? {edition: reference(editionId)} : {}),
        addedAt: book.addedAt ? `${book.addedAt}T00:00:00.000Z` : new Date().toISOString(),
      })
    await tx.commit({visibility: 'sync'})
  } catch (error) {
    if (!isConflict(error)) throw error
    const ratingAdded = await importMissingRating(client, readerId, bookId, book.rating)
    return {row: book.row, title: book.title, status: ratingAdded ? 'updated' : 'skipped', message: 'Kept your existing library entry and filled any missing rating.'}
  }
  await importMissingRating(client, readerId, bookId, book.rating)
  return {row: book.row, title: book.title, status: 'imported'}
}
