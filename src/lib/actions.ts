import 'server-only'
import {cache} from 'react'
import {revalidatePath} from 'next/cache'
import {privateClient, writeClient} from '@/sanity/client'
import {bookCoverProjection, editionCoverFields, shelfBookCoverProjection} from '@/sanity/queries'
import {getOptionalReader, requireReader} from './reader'
import {saveBookRating, saveBookStatus, saveBookReview, saveBookEdition} from './library-book'
import {fetchGoogleVolume} from './google-books-api'
import {GOOGLE_VOLUME_ID} from './google-books'
import {resolveSearchBook} from './search-book'
import {ensureImportEdition} from './import-edition'
import {resolveEditionMetadata} from './edition-metadata'
import {normalizeIsbn} from './isbn'
import {searchCatalogParams} from './search-catalog'
import {findBookEdition, getBookEditions} from './book-editions'
import {ReaderDataError} from './reader-data-error'
import {
  canTransition,
  readingStatusSchema,
  shelfBookSchema,
  spaceColorSchema,
  stableId,
  workflowStatusSchema,
  type ReadingPeriod,
  type ReviewFields,
  type ShelfBook,
} from './validation'

export async function setRating(bookId: string, value: number | null) {
  const reader = await requireReader()
  await saveBookRating(writeClient(), reader.readerId, bookId, value)
  revalidatePath('/books/[slug]', 'page')
  revalidatePath('/my-shelves')
}

export async function setBookReview(
  bookId: string,
  review: ReviewFields | null,
) {
  const reader = await requireReader()
  await saveBookReview(writeClient(), reader.readerId, bookId, review)
  revalidatePath('/books/[slug]', 'page')
  revalidatePath('/profile')
  revalidatePath('/')
}

export async function setReadingStatus(
  bookId: string,
  status: string | null,
  readingPeriod?: ReadingPeriod,
  appendRead = false,
) {
  const reader = await requireReader()
  await saveBookStatus(writeClient(), reader.readerId, bookId, status, readingPeriod, appendRead)
  revalidatePath('/my-shelves')
  revalidatePath('/books/[slug]', 'page')
  revalidatePath('/search/[id]', 'page')
}

/** Shared entry point for web actions and the native HTTP API. */
export async function setShelfStatus(
  book: ShelfBook,
  status: string | null,
  readingPeriod?: ReadingPeriod,
  appendRead = false,
) {
  const target = shelfBookSchema.parse(book)
  if (target.source === 'googleBooks') return setSearchReadingStatus(target.id, status, readingPeriod, appendRead)
  await setReadingStatus(target.id, status, readingPeriod, appendRead)
  return target.id
}

export async function setSearchReadingStatus(
  volumeId: string,
  status: string | null,
  readingPeriod?: ReadingPeriod,
  appendRead = false,
) {
  const reader = await requireReader()
  if (typeof volumeId !== 'string' || !GOOGLE_VOLUME_ID.test(volumeId)) throw new ReaderDataError('Invalid book ID.', 400, 'invalid_request')
  const parsed = status === null ? null : readingStatusSchema.parse(status)
  const book = await fetchGoogleVolume(volumeId)
  if (!book || book.id !== volumeId) throw new ReaderDataError('Book not found.', 404, 'book_not_found')
  const client = writeClient()
  const bookId = await resolveSearchBook(client, book, parsed !== null)
  if (bookId) {
    await saveBookStatus(client, reader.readerId, bookId, parsed, readingPeriod, appendRead)
    if (parsed) {
      const ids = searchCatalogParams(book)
      const editionId = normalizeIsbn(ids.isbn13 || ids.isbn10) ? await ensureImportEdition(client, bookId, {
        title: book.volumeInfo?.title || '', author: book.volumeInfo?.authors?.[0] || '',
        isbn10: ids.isbn10 || undefined, isbn13: ids.isbn13 || undefined,
      }, resolveEditionMetadata) : undefined
      if (editionId) await saveBookEdition(client, reader.readerId, bookId, editionId)
    }
  }
  revalidatePath('/my-shelves')
  revalidatePath('/search/[id]', 'page')
  revalidatePath('/books/[slug]', 'page')
  return bookId ?? null
}

export async function setSelectedEdition(bookId: string, editionId: string | null) {
  const reader = await requireReader()
  await saveBookEdition(writeClient(), reader.readerId, bookId, editionId)
  revalidatePath('/my-shelves')
  revalidatePath('/books/[slug]', 'page')
}

export async function lookupBookEdition(bookId: string, isbn: string) {
  await requireReader()
  const client = writeClient()
  const editionId = await findBookEdition(client, bookId, isbn)
  return {editionId, editions: await getBookEditions(client, bookId)}
}

export type ReaderBookState = {
  editionId: string | null
  rating: number | null
  status: string | null
  readingPeriod: ReadingPeriod | null
  dateRead: string | null
  dateAdded: string | null
  readCount: number | null
  importSource: string | null
  review: ReviewFields | null
  csv: {
    goodreadsId: string | null
    title: string | null
    authors: string[]
    isbn10: string | null
    isbn13: string | null
    status: string | null
    rating: number | null
    dateAdded: string | null
    dateRead: string | null
    readCount: number | null
    publicationYear: number | null
    importSource: string | null
  } | null
}

const emptyReaderBookState: ReaderBookState = {
  editionId: null,
  rating: null,
  status: null,
  readingPeriod: null,
  dateRead: null,
  dateAdded: null,
  readCount: null,
  importSource: null,
  review: null,
  csv: null,
}

export const getReaderBookState = cache(async function getReaderBookState(bookId: string): Promise<ReaderBookState> {
  const reader = await getOptionalReader()
  if (!reader) return emptyReaderBookState

  const data = await privateClient.fetch<{
    rating?: number | null
    review?: {
      title?: string | null
      body?: string | null
      hasSpoilers?: boolean | null
      visibility?: string | null
    } | null
    progress?: {
      editionId?: string | null
      edition?: {isbn10?: string; isbn13?: string; publicationDate?: string} | null
      status?: string | null
      readingPeriod?: ReadingPeriod | null
      finishedAt?: string | null
      readCount?: number | null
      importSource?: string | null
    } | null
    addedAt?: string | null
    book?: {
      title?: string | null
      goodreadsBookId?: string | null
      publishedDate?: string | null
      authors?: string[] | null
      isbn10?: string | null
      isbn13?: string | null
    } | null
  } | null>(
    `{
      "rating": *[_type == "rating" && reader._ref == $readerId && book._ref == $bookId][0].value,
      "review": *[_type == "review" && reader._ref == $readerId && book._ref == $bookId][0]{title, body, hasSpoilers, visibility},
      "progress": *[_type == "readingProgress" && reader._ref == $readerId && book._ref == $bookId][0]{
        status, readingPeriod, finishedAt, readCount, importSource, "editionId": edition._ref, edition->{isbn10, isbn13, publicationDate}
      },
      "addedAt": *[_type == "shelfEntry" && book._ref == $bookId && shelf->owner._ref == $readerId] | order(addedAt desc)[0].addedAt,
      "book": *[_id == $bookId][0]{
        title,
        goodreadsBookId,
        publishedDate,
        "authors": authors,
        isbn10,
        isbn13
      }
    }`,
    {readerId: reader.readerId, bookId},
    {cache: 'no-store'},
  )

  const rating = data?.rating ?? null
  const status = data?.progress?.status ?? null
  const readingPeriod = data?.progress?.readingPeriod?.end
    ? data.progress.readingPeriod
    : data?.progress?.finishedAt
      ? {end: data.progress.finishedAt}
      : null
  const dateRead = readingPeriod?.end ?? null
  const dateAdded = data?.addedAt ?? null
  const readCount = data?.progress?.readCount ?? null
  const importSource = data?.progress?.importSource ?? null
  const visibility: 'private' | 'public' = data?.review?.visibility === 'public' ? 'public' : 'private'
  const review = data?.review?.body?.trim()
    ? {
        title: data.review.title?.trim() ?? '',
        body: data.review.body.trim(),
        hasSpoilers: Boolean(data.review.hasSpoilers),
        visibility,
      }
    : null
  const selected = data?.progress?.edition
  const publicationYear = Number((selected ? selected.publicationDate : data?.book?.publishedDate)?.slice(0, 4))

  return {
    editionId: data?.progress?.editionId ?? null,
    rating,
    status,
    readingPeriod,
    dateRead,
    dateAdded,
    readCount,
    importSource,
    review,
    csv: {
      goodreadsId: data?.book?.goodreadsBookId ?? null,
      title: data?.book?.title ?? null,
      authors: data?.book?.authors?.filter(Boolean) ?? [],
      isbn10: (selected ? selected.isbn10 : data?.book?.isbn10) ?? null,
      isbn13: (selected ? selected.isbn13 : data?.book?.isbn13) ?? null,
      status,
      rating,
      dateAdded,
      dateRead,
      readCount,
      publicationYear: Number.isInteger(publicationYear) && publicationYear >= 1000 && publicationYear <= 2100
        ? publicationYear
        : null,
      importSource,
    },
  }
})

export async function getMyBooks() {
  const reader = await requireReader()
  return privateClient.fetch(
    `{
      "shelves": *[_type == "shelf" && owner._ref == $readerId] | order(kind asc, name asc){
        _id,
        name,
        kind,
        "entries": *[_type == "shelfEntry" && shelf._ref == ^._id]{
          _id,
          addedAt,
          "editionId": edition._ref,
          "book": book->{
            _id,
            title,
            "slug": coalesce(slug.current, _id),
            publishedDate,
            "myRating": *[_type == "rating" && reader._ref == $readerId && book._ref == ^._id][0].value,
            "percent": *[_type == "readingProgress" && reader._ref == $readerId && book._ref == ^._id][0].percent,
            "readingPeriod": *[_type == "readingProgress" && reader._ref == $readerId && book._ref == ^._id][0]{
              "start": coalesce(readingPeriod.start, startedAt),
              "end": coalesce(readingPeriod.end, finishedAt)
            },
            "readCount": *[_type == "readingProgress" && reader._ref == $readerId && book._ref == ^._id][0].readCount,
            "authors": authors,
            "cover": ${shelfBookCoverProjection}
          }
        } | order(addedAt desc)
      },
      "ratings": *[_type == "rating" && reader._ref == $readerId]{
        value,
        "bookId": book._ref
      }
    }`,
    {readerId: reader.readerId},
    {cache: 'no-store'},
  )
}

const profileBookCover = /* groq */ `coalesce(
  select(defined(coverOverride.asset) => @{${editionCoverFields}}),
  edition->{${editionCoverFields}},
  ${bookCoverProjection}
)`

export type ProfileRating = {
  value: number
  book: {
    _id: string
    title: string
    slug?: string | null
    authors?: string[] | null
    cover?: import('@/components/BookCover').CoverSource | null
  } | null
}

export type ProfileReview = {
  title: string
  body: string
  hasSpoilers: boolean
  visibility: 'private' | 'public'
  rating?: number | null
  book: ProfileRating['book']
}

export async function getReaderProfileShowcase() {
  const reader = await requireReader()
  const data = await privateClient.fetch<{
    ratings?: ProfileRating[] | null
    reviews?: {
      title?: string | null
      body?: string | null
      hasSpoilers?: boolean | null
      visibility?: string | null
      rating?: number | null
      book?: ProfileRating['book']
    }[] | null
  }>(
    `{
      "ratings": *[_type == "rating" && reader._ref == $readerId && defined(book._ref)] | order(_updatedAt desc){
        value,
        "book": book->{
          _id,
          title,
          "slug": coalesce(slug.current, _id),
          authors,
          "cover": ${profileBookCover}
        }
      },
      "reviews": *[_type == "review" && reader._ref == $readerId && defined(book._ref) && moderationStatus != "hidden"] | order(_updatedAt desc){
        title,
        body,
        hasSpoilers,
        visibility,
        "rating": *[_type == "rating" && reader._ref == $readerId && book._ref == ^.book._ref][0].value,
        "book": book->{
          _id,
          title,
          "slug": coalesce(slug.current, _id),
          authors,
          "cover": ${profileBookCover}
        }
      }
    }`,
    {readerId: reader.readerId},
    {cache: 'no-store'},
  )
  return {
    ratings: (data.ratings ?? []).filter((row) => row.book?._id && typeof row.value === 'number'),
    reviews: (data.reviews ?? []).flatMap((row) => {
      if (!row.book?._id || !row.body?.trim()) return []
      return [{
        title: row.title?.trim() ?? '',
        body: row.body.trim(),
        hasSpoilers: Boolean(row.hasSpoilers),
        visibility: row.visibility === 'public' ? 'public' as const : 'private' as const,
        rating: typeof row.rating === 'number' ? row.rating : null,
        book: row.book,
      }]
    }),
  }
}

export async function joinClub(clubId: string) {
  const reader = await requireReader()
  const club = await privateClient.fetch<{visibility?: string} | null>(
    `*[_type == "communityClub" && _id == $clubId][0]{visibility}`,
    {clubId},
    {cache: 'no-store'},
  )
  if (!club) throw new Error('Club not found')
  if (club.visibility === 'private') throw new Error('This club is private.')

  await writeClient().createIfNotExists({
    _id: stableId(['membership', clubId, reader.readerId]),
    _type: 'clubMembership',
    club: {_type: 'reference', _ref: clubId},
    reader: {_type: 'reference', _ref: reader.readerId},
    role: 'member',
    status: 'active',
  })
  revalidatePath('/clubs')
}

export async function castVote(pollId: string, bookId: string) {
  const reader = await requireReader()
  const poll = await privateClient.fetch<{
    status?: string
    allowVoteChange?: boolean
    options?: {_ref: string}[]
    club?: {_ref: string}
  } | null>(
    `*[_type == "poll" && _id == $pollId][0]{status, allowVoteChange, options, club}`,
    {pollId},
    {cache: 'no-store'},
  )
  if (!poll || poll.status !== 'open') throw new Error('This poll is closed.')
  if (!poll.options?.some((option) => option._ref === bookId)) {
    throw new Error('That book is not on this ballot.')
  }

  const membership = await privateClient.fetch<{_id?: string} | null>(
    `*[_type == "clubMembership" && club._ref == $clubId && reader._ref == $readerId && status == "active"][0]{_id}`,
    {clubId: poll.club?._ref, readerId: reader.readerId},
    {cache: 'no-store'},
  )
  if (!membership?._id) throw new Error('Join the club to vote.')

  const voteId = stableId(['vote', pollId, reader.readerId])
  const existing = await privateClient.fetch<{_id?: string} | null>(
    `*[_id == $voteId][0]{_id}`,
    {voteId},
    {cache: 'no-store'},
  )
  if (existing?._id && poll.allowVoteChange === false) {
    throw new Error('Votes cannot be changed on this poll.')
  }

  await writeClient().createOrReplace({
    _id: voteId,
    _type: 'vote',
    poll: {_type: 'reference', _ref: pollId},
    reader: {_type: 'reference', _ref: reader.readerId},
    option: {_type: 'reference', _ref: bookId},
  })
  revalidatePath('/clubs')
}

export async function createDiscussionPost(threadId: string, body: string, hasSpoilers: boolean) {
  const reader = await requireReader()
  const thread = await privateClient.fetch<{club?: {_ref: string}} | null>(
    `*[_type == "discussionThread" && _id == $threadId][0]{club}`,
    {threadId},
    {cache: 'no-store'},
  )
  const membership = await privateClient.fetch<{role?: string} | null>(
    `*[_type == "clubMembership" && club._ref == $clubId && reader._ref == $readerId && status == "active"][0]{role}`,
    {clubId: thread?.club?._ref, readerId: reader.readerId},
    {cache: 'no-store'},
  )
  if (!membership) throw new Error('Join the club to post.')
  if (!body.trim()) throw new Error('Write a few words first.')

  await writeClient().create({
    _type: 'discussionPost',
    thread: {_type: 'reference', _ref: threadId},
    author: {_type: 'reference', _ref: reader.readerId},
    body: body.trim(),
    hasSpoilers,
    moderationStatus: 'visible',
    isDemoActivity: false,
  })
  revalidatePath('/clubs')
}

export async function moderatePost(postId: string, moderationStatus: 'visible' | 'hidden') {
  const reader = await requireReader()
  const post = await privateClient.fetch<{thread?: {_ref: string}} | null>(
    `*[_type == "discussionPost" && _id == $postId][0]{thread}`,
    {postId},
    {cache: 'no-store'},
  )
  const thread = await privateClient.fetch<{club?: {_ref: string}} | null>(
    `*[_type == "discussionThread" && _id == $threadId][0]{club}`,
    {threadId: post?.thread?._ref},
    {cache: 'no-store'},
  )
  const membership = await privateClient.fetch<{role?: string} | null>(
    `*[_type == "clubMembership" && club._ref == $clubId && reader._ref == $readerId && status == "active"][0]{role}`,
    {clubId: thread?.club?._ref, readerId: reader.readerId},
    {cache: 'no-store'},
  )
  if (!membership || !['owner', 'moderator'].includes(membership.role || '')) {
    throw new Error('Only moderators can hide posts.')
  }
  await writeClient().patch(postId).set({moderationStatus}).commit()
  revalidatePath('/clubs')
}

export async function transitionWorkflow(documentId: string, nextStatus: string, note?: string) {
  const parsed = workflowStatusSchema.parse(nextStatus)
  const doc = await privateClient.fetch<{
    workflowStatus?: string
  } | null>(`*[_id == $documentId][0]{workflowStatus}`, {documentId}, {cache: 'no-store'})
  if (!doc) throw new Error('Document not found')
  const current = doc.workflowStatus || 'proposed'
  if (!canTransition(current, parsed)) {
    throw new Error(`Cannot move from ${current} to ${parsed}`)
  }
  const patch: Record<string, unknown> = {workflowStatus: parsed}
  if (parsed === 'approved' || parsed === 'rejected') {
    patch.reviewedAt = new Date().toISOString()
    patch.reviewedBy = 'server-action'
    if (note) patch.note = note
  }
  await writeClient().patch(documentId).set(patch).commit()
  revalidatePath('/')
  revalidatePath('/picks')
  revalidatePath('/browse')
}

export async function getClubExperience(clubId: string) {
  const reader = await getOptionalReader()
  return privateClient.fetch(
    `{
      "membership": ${
        reader
          ? `*[_type == "clubMembership" && club._ref == $clubId && reader._ref == $readerId][0]{role, status}`
          : `null`
      },
      "poll": *[_type == "poll" && club._ref == $clubId] | order(_updatedAt desc)[0]{
        _id,
        title,
        status,
        allowVoteChange,
        "options": options[]->{ _id, title, "slug": slug.current, "authors": authors },
        "tallies": options[]{
          "_ref": _ref,
          "count": count(*[_type == "vote" && poll._ref == ^.^._id && option._ref == ^._ref])
        },
        "myVote": ${
          reader
            ? `*[_type == "vote" && poll._ref == ^._id && reader._ref == $readerId][0].option._ref`
            : `null`
        }
      },
      "thread": *[_type == "discussionThread" && club._ref == $clubId] | order(_updatedAt desc)[0]{
        _id,
        title,
        spoilerBoundary,
        isDemoThread,
        "posts": *[_type == "discussionPost" && thread._ref == ^._id && moderationStatus == "visible"] | order(_createdAt asc){
          _id,
          body,
          hasSpoilers,
          isDemoActivity,
          _createdAt,
          "authorName": author->displayName
        }
      }
    }`,
    {clubId, readerId: reader?.readerId || ''},
    {cache: 'no-store'},
  )
}

export async function setSpaceColor(color: string) {
  const reader = await requireReader()
  const parsed = spaceColorSchema.parse(color)
  await writeClient().patch(reader.readerId).set({spaceColor: parsed}).commit()
  revalidatePath('/', 'layout')
}

const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const AVATAR_MAX_BYTES = 8 * 1024 * 1024

function avatarContentType(file: Blob & {name?: string}) {
  if (AVATAR_TYPES.has(file.type)) return file.type
  const name = file.name?.toLowerCase() || ''
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.heic')) return 'image/heic'
  if (name.endsWith('.heif')) return 'image/heif'
  return ''
}

export async function setProfileAvatar(file: Blob & {name?: string}) {
  const reader = await requireReader()
  const contentType = avatarContentType(file)
  if (!contentType) throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('Please choose an image smaller than 8 MB.')
  const client = writeClient()
  const asset = await client.assets.upload('image', Buffer.from(await file.arrayBuffer()), {
    filename: (file.name || 'avatar.jpg').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'avatar.jpg',
    contentType,
  })
  await client.patch(reader.readerId).set({
    avatar: {
      _type: 'image',
      asset: {_type: 'reference', _ref: asset._id},
      alt: reader.displayName,
    },
  }).commit()
  revalidatePath('/', 'layout')
  revalidatePath('/settings')
}

export async function clearProfileAvatar() {
  const reader = await requireReader()
  await writeClient().patch(reader.readerId).unset(['avatar']).commit()
  revalidatePath('/', 'layout')
  revalidatePath('/settings')
}
