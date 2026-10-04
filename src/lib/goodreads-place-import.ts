import type {SanityClient} from '@sanity/client'
import {stableId} from './validation'

const reference = (_ref: string) => ({_type: 'reference', _ref})

type Placement = {
  _key?: string
  reader?: {_ref?: string} | null
  shelfStatus?: 'finished' | 'currentlyReading' | 'wantToRead' | null
  rating?: number
  addedAt?: string
  finishedAt?: string
  readCount?: number
}

async function importMissingRating(client: SanityClient, readerId: string, bookId: string, value?: number) {
  if (value === undefined) return
  const existing = await client.fetch<boolean>(
    `count(*[_type == "rating" && reader._ref == $readerId && book._ref == $bookId]) > 0`,
    {readerId, bookId},
    {cache: 'no-store'},
  )
  if (existing) return
  await client.createIfNotExists({
    _id: stableId(['rating', readerId, bookId]),
    _type: 'rating',
    reader: reference(readerId),
    book: reference(bookId),
    value,
  }, {visibility: 'sync'})
}

export async function placePendingGoodreadsImports(client: SanityClient, bookId: string) {
  const id = bookId.replace(/^drafts\./, '')
  if (bookId.startsWith('drafts.')) {
    throw new Error('Publish the book before adding it to a reader’s shelf.')
  }
  const book = await client.fetch<{
    _id: string
    title?: string | null
    authors?: (string | null)[] | null
    pendingImportPlacements?: Placement[] | null
  } | null>(
    `*[_type == "book" && _id == $id][0]{_id, title, authors, pendingImportPlacements}`,
    {id},
    {cache: 'no-store'},
  )
  if (!book) throw new Error('Publish the book before adding it to a reader’s shelf.')

  const placements = (book.pendingImportPlacements || []).filter(
    (placement): placement is Placement & {reader: {_ref: string}; shelfStatus: NonNullable<Placement['shelfStatus']>} =>
      Boolean(placement.reader?._ref && placement.shelfStatus),
  )
  if (!placements.length) return {placed: 0}

  for (const placement of placements) {
    const readerId = placement.reader._ref
    const alreadyOnShelf = await client.fetch<boolean>(
      `count(*[_type == "shelfEntry" && book._ref == $bookId && shelf->owner._ref == $readerId && shelf->kind in ["finished", "currentlyReading", "wantToRead"]]) > 0`,
      {bookId: id, readerId},
      {cache: 'no-store'},
    )
    if (!alreadyOnShelf) {
      const shelfId = stableId(['shelf', readerId, placement.shelfStatus])
      await client
        .transaction()
        .createIfNotExists({
          _id: stableId(['progress', readerId, id]),
          _type: 'readingProgress',
          reader: reference(readerId),
          book: reference(id),
          status: placement.shelfStatus,
          importSource: 'goodreads',
          ...(placement.finishedAt ? {finishedAt: placement.finishedAt} : {}),
          ...(placement.readCount !== undefined ? {readCount: placement.readCount} : {}),
        })
        .createIfNotExists({
          _id: stableId(['shelfEntry', shelfId, id]),
          _type: 'shelfEntry',
          shelf: reference(shelfId),
          book: reference(id),
          addedAt: placement.addedAt ? `${placement.addedAt}T00:00:00.000Z` : new Date().toISOString(),
        })
        .commit({visibility: 'sync'})
    }
    await importMissingRating(client, readerId, id, placement.rating)
    const failureIds = await client.fetch<string[]>(
      `*[_type == "catalogImportFailure" && reader._ref == $readerId && book._ref == $bookId]._id`,
      {readerId, bookId: id},
      {cache: 'no-store'},
    )
    for (const failureId of failureIds) {
      await client.patch(failureId).set({resolvedAt: new Date().toISOString()}).commit()
    }
  }

  await client.patch(id).unset(['pendingImportPlacements']).commit()
  return {placed: placements.length}
}

export async function placeCatalogImportFailure(client: SanityClient, failureId: string) {
  const failure = await client.fetch<{
    _id: string
    title?: string | null
    author?: string | null
    reader?: {_ref?: string} | null
    book?: {_ref?: string} | null
    shelfStatus?: Placement['shelfStatus']
    rating?: number
    addedAt?: string
    finishedAt?: string
    readCount?: number
    resolvedAt?: string | null
  } | null>(
    `*[_id == $id][0]{_id, title, author, reader, book, shelfStatus, rating, addedAt, finishedAt, readCount, resolvedAt}`,
    {id: failureId.replace(/^drafts\./, '')},
    {cache: 'no-store'},
  )
  if (!failure?.reader?._ref) throw new Error('This import request is missing a reader.')
  if (!failure.book?._ref) throw new Error('Link the existing catalog book before adding it to the reader’s shelf.')
  if (!failure.shelfStatus) throw new Error('This import request is missing a shelf.')

  const bookId = failure.book._ref
  const readerId = failure.reader._ref
  const alreadyOnShelf = await client.fetch<boolean>(
    `count(*[_type == "shelfEntry" && book._ref == $bookId && shelf->owner._ref == $readerId && shelf->kind in ["finished", "currentlyReading", "wantToRead"]]) > 0`,
    {bookId, readerId},
    {cache: 'no-store'},
  )
  if (!alreadyOnShelf) {
    const shelfId = stableId(['shelf', readerId, failure.shelfStatus])
    await client
      .transaction()
      .createIfNotExists({
        _id: stableId(['progress', readerId, bookId]),
        _type: 'readingProgress',
        reader: reference(readerId),
        book: reference(bookId),
        status: failure.shelfStatus,
        importSource: 'goodreads',
        ...(failure.finishedAt ? {finishedAt: failure.finishedAt} : {}),
        ...(failure.readCount !== undefined ? {readCount: failure.readCount} : {}),
      })
      .createIfNotExists({
        _id: stableId(['shelfEntry', shelfId, bookId]),
        _type: 'shelfEntry',
        shelf: reference(shelfId),
        book: reference(bookId),
        addedAt: failure.addedAt ? `${failure.addedAt}T00:00:00.000Z` : new Date().toISOString(),
      })
      .commit({visibility: 'sync'})
    await importMissingRating(client, readerId, bookId, failure.rating)
  }
  await client.patch(failure._id).set({resolvedAt: new Date().toISOString()}).commit()
  return {placed: alreadyOnShelf ? 0 : 1, bookId}
}
