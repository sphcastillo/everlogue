import type {SanityClient} from '@sanity/client'
import {ReaderDataError} from './reader-data-error'
import {ratingValueSchema, readingPeriodSchema, readingStatusSchema, reviewBodySchema, reviewTitleSchema, reviewVisibilitySchema, stableId, type ReadingPeriod, type ReviewFields} from './validation'

const reference = (_ref: string) => ({_type: 'reference', _ref})

export async function saveBookEdition(client: SanityClient, readerId: string, bookId: string, editionId: string | null) {
  await requireBook(client, bookId)
  if (editionId !== null) {
    if (typeof editionId !== 'string' || !editionId.trim()) throw new Error('Choose an edition.')
    const valid = await client.fetch<boolean>(
      `count(*[_type == "edition" && _id == $editionId && !(_id in path("drafts.**")) && book._ref == $bookId]) == 1`,
      {editionId, bookId}, {cache: 'no-store'},
    )
    if (!valid) throw new Error('This edition does not belong to this book.')
  }
  const [progress, entries] = await Promise.all([
    client.fetch<{_id: string} | null>(`*[_type == "readingProgress" && reader._ref == $readerId && book._ref == $bookId][0]{_id}`, {readerId, bookId}, {cache: 'no-store'}),
    client.fetch<{_id: string}[]>(`*[_type == "shelfEntry" && shelf->owner._ref == $readerId && book._ref == $bookId]{_id}`, {readerId, bookId}, {cache: 'no-store'}),
  ])
  if (!progress) throw new Error('Add this book to a reading shelf before choosing an edition.')
  const tx = client.transaction()
  for (const doc of [progress, ...entries]) {
    tx.patch(doc._id, (patch) => editionId ? patch.set({edition: reference(editionId)}) : patch.unset(['edition']))
  }
  await tx.commit({visibility: 'sync'})
}

async function requireBook(client: SanityClient, bookId: string) {
  if (typeof bookId !== 'string' || !bookId.trim()) {
    throw new ReaderDataError('A catalog book ID is required. Reload the book and try again.', 400, 'invalid_request')
  }
  const exists = await client.fetch<boolean>(
    `count(*[_type == "book" && _id == $bookId]) == 1`, {bookId}, {cache: 'no-store'},
  )
  if (!exists) throw new ReaderDataError('This book is not in the catalog.', 404, 'book_not_found')
}

export async function saveBookRating(client: SanityClient, readerId: string, bookId: string, value: number | null) {
  const parsed = value === null ? null : ratingValueSchema.parse(value)
  await requireBook(client, bookId)
  if (parsed !== null) {
    const status = await client.fetch<string | null>(
      `*[_type == "readingProgress" && reader._ref == $readerId && book._ref == $bookId][0].status`,
      {readerId, bookId},
      {cache: 'no-store'},
    )
    if (status !== 'currentlyReading' && status !== 'finished') {
      throw new ReaderDataError('Mark this book as Currently Reading or Read before rating it.', 409, 'reading_status_required')
    }
  }
  // Migrated library documents keep their original IDs. Resolve by relationship
  // rather than assuming the ID was generated from the current book ID.
  const existing = await client.fetch<{_id: string} | null>(
    `*[_type == "rating" && reader._ref == $readerId && book._ref == $bookId][0]{_id}`,
    {readerId, bookId}, {cache: 'no-store'},
  )
  if (parsed === null) {
    if (existing) await client.delete(existing._id, {visibility: 'sync'})
  } else if (existing) {
    await client.patch(existing._id).set({value: parsed}).commit({visibility: 'sync'})
  } else {
    await client.createOrReplace({
      _id: stableId(['rating', readerId, bookId]), _type: 'rating',
      reader: reference(readerId), book: reference(bookId), value: parsed,
    }, {visibility: 'sync'})
  }
  const ratings = await client.fetch<number[]>(
    `*[_type == "rating" && book._ref == $bookId && value > 0 && value <= 5].value`,
    {bookId}, {cache: 'no-store'},
  )
  await client.patch(bookId).set({ratingStats: {
    _type: 'ratingStats', count: ratings.length,
    average: ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 100) / 100 : 0,
    updatedAt: new Date().toISOString(),
  }}).commit({visibility: 'sync'})
}

export async function saveBookStatus(
  client: SanityClient,
  readerId: string,
  bookId: string,
  status: string | null,
  readingPeriod?: ReadingPeriod,
) {
  const parsed = status === null ? null : readingStatusSchema.parse(status)
  const parsedPeriod = parsed === 'finished' && readingPeriod ? readingPeriodSchema.parse(readingPeriod) : null
  await requireBook(client, bookId)
  const [progress, shelves, entries] = await Promise.all([
    client.fetch<{_id: string; edition?: {_type: 'reference'; _ref: string}} | null>(
      `*[_type == "readingProgress" && reader._ref == $readerId && book._ref == $bookId][0]{_id, edition}`,
      {readerId, bookId}, {cache: 'no-store'},
    ),
    client.fetch<{_id: string; kind: string}[]>(
      `*[_type == "shelf" && owner._ref == $readerId && kind in ["wantToRead", "currentlyReading", "finished"]]{_id, kind}`,
      {readerId}, {cache: 'no-store'},
    ),
    client.fetch<{_id: string; shelfId: string}[]>(
      `*[_type == "shelfEntry" && book._ref == $bookId && shelf->owner._ref == $readerId && shelf->kind in ["wantToRead", "currentlyReading", "finished"]]{_id, "shelfId": shelf._ref}`,
      {readerId, bookId}, {cache: 'no-store'},
    ),
  ])
  const target = shelves.find((shelf) => shelf.kind === parsed)
  if (parsed && !target) throw new ReaderDataError('Your reading shelf could not be found.', 409, 'shelf_not_found')
  const tx = client.transaction()
  for (const entry of entries) if (entry.shelfId !== target?._id) tx.delete(entry._id)
  if (target && !entries.some((entry) => entry.shelfId === target._id)) {
    tx.createIfNotExists({
      _id: stableId(['shelfEntry', target._id, bookId]), _type: 'shelfEntry',
      shelf: reference(target._id), book: reference(bookId),
      addedAt: new Date().toISOString(), ...(progress?.edition ? {edition: progress.edition} : {}),
    })
  }
  if (parsed) {
    const progressId = progress?._id || stableId(['progress', readerId, bookId])
    if (!progress) tx.createIfNotExists({
      _id: progressId, _type: 'readingProgress', reader: reference(readerId), book: reference(bookId), status: parsed,
    })
    const date = new Date().toISOString().slice(0, 10)
    tx.patch(progressId, (patch) => patch.set({
      status: parsed,
      ...(parsedPeriod ? {
        readingPeriod: {_type: 'readingPeriod', ...parsedPeriod},
        ...(parsedPeriod.start?.length === 10 ? {startedAt: parsedPeriod.start} : {}),
        ...(parsedPeriod.end.length === 10 ? {finishedAt: parsedPeriod.end} : {}),
      } : {}),
    }).setIfMissing({
      ...(parsed === 'currentlyReading' ? {startedAt: date} : {}),
      ...(parsed === 'finished' ? {finishedAt: date} : {}),
    }))
  } else if (progress) {
    tx.delete(progress._id)
  }
  if (tx.serialize().length) await tx.commit({visibility: 'sync'})
}

export async function saveBookReview(
  client: SanityClient,
  readerId: string,
  bookId: string,
  review: ReviewFields | null,
) {
  await requireBook(client, bookId)
  const existing = await client.fetch<{_id: string} | null>(
    `*[_type == "review" && reader._ref == $readerId && book._ref == $bookId][0]{_id}`,
    {readerId, bookId}, {cache: 'no-store'},
  )
  if (review === null) {
    if (existing) await client.delete(existing._id, {visibility: 'sync'})
    return
  }
  const status = await client.fetch<string | null>(
    `*[_type == "readingProgress" && reader._ref == $readerId && book._ref == $bookId][0].status`,
    {readerId, bookId}, {cache: 'no-store'},
  )
  if (status !== 'finished') throw new Error('Mark this book as Read before leaving a review.')
  const title = reviewTitleSchema.parse(review.title)
  const body = reviewBodySchema.parse(review.body)
  const visibility = reviewVisibilitySchema.parse(review.visibility)
  const fields = {
    title,
    body,
    hasSpoilers: Boolean(review.hasSpoilers),
    visibility,
    moderationStatus: 'visible',
  }
  if (existing) {
    await client.patch(existing._id).set(fields).commit({visibility: 'sync'})
    return
  }
  await client.createOrReplace({
    _id: stableId(['review', readerId, bookId]),
    _type: 'review',
    reader: reference(readerId),
    book: reference(bookId),
    ...fields,
  }, {visibility: 'sync'})
}
