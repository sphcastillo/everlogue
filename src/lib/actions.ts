import 'server-only'
import {revalidatePath} from 'next/cache'
import {privateClient, writeClient} from '@/sanity/client'
import {bookCoverProjection, editionCoverFields} from '@/sanity/queries'
import {getOptionalReader, requireReader} from './reader'
import {saveBookRating, saveBookStatus, saveBookReview} from './library-book'
import {fetchGoogleVolume} from './google-books-api'
import {GOOGLE_VOLUME_ID} from './google-books'
import {resolveSearchBook} from './search-book'
import {
  canTransition,
  readingStatusSchema,
  spaceColorSchema,
  stableId,
  workflowStatusSchema,
} from './validation'

export async function setRating(bookId: string, value: number | null) {
  const reader = await requireReader()
  await saveBookRating(writeClient(), reader.readerId, bookId, value)
  revalidatePath('/books/[slug]', 'page')
  revalidatePath('/my-books')
}

export async function setBookReview(
  bookId: string,
  review: {body: string; hasSpoilers: boolean; visibility: 'private' | 'public'} | null,
) {
  const reader = await requireReader()
  await saveBookReview(writeClient(), reader.readerId, bookId, review)
  revalidatePath('/books/[slug]', 'page')
  revalidatePath('/')
}

export async function setReadingStatus(bookId: string, status: string | null) {
  const reader = await requireReader()
  await saveBookStatus(writeClient(), reader.readerId, bookId, status)
  revalidatePath('/my-books')
  revalidatePath('/books/[slug]', 'page')
  revalidatePath('/search/[id]', 'page')
}

export async function setSearchReadingStatus(volumeId: string, status: string | null) {
  const reader = await requireReader()
  if (typeof volumeId !== 'string' || !GOOGLE_VOLUME_ID.test(volumeId)) throw new Error('Invalid book ID.')
  const parsed = status === null ? null : readingStatusSchema.parse(status)
  const book = await fetchGoogleVolume(volumeId)
  if (!book || book.id !== volumeId) throw new Error('Book not found.')
  const client = writeClient()
  const bookId = await resolveSearchBook(client, book, parsed !== null)
  if (bookId) await saveBookStatus(client, reader.readerId, bookId, parsed)
  revalidatePath('/my-books')
  revalidatePath('/search/[id]', 'page')
  revalidatePath('/books/[slug]', 'page')
}

export type ReaderBookState = {
  rating: number | null
  status: string | null
  dateRead: string | null
  dateAdded: string | null
  readCount: number | null
  importSource: string | null
  review: {
    body: string
    hasSpoilers: boolean
    visibility: 'private' | 'public'
  } | null
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
  rating: null,
  status: null,
  dateRead: null,
  dateAdded: null,
  readCount: null,
  importSource: null,
  review: null,
  csv: null,
}

export async function getReaderBookState(bookId: string): Promise<ReaderBookState> {
  const reader = await getOptionalReader()
  if (!reader) return emptyReaderBookState

  const data = await privateClient.fetch<{
    rating?: number | null
    review?: {
      body?: string | null
      hasSpoilers?: boolean | null
      visibility?: string | null
    } | null
    progress?: {
      status?: string | null
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
      "review": *[_type == "review" && reader._ref == $readerId && book._ref == $bookId][0]{body, hasSpoilers, visibility},
      "progress": *[_type == "readingProgress" && reader._ref == $readerId && book._ref == $bookId][0]{
        status, finishedAt, readCount, importSource
      },
      "addedAt": *[_type == "shelfEntry" && book._ref == $bookId && shelf->owner._ref == $readerId] | order(addedAt desc)[0].addedAt,
      "book": *[_id == $bookId][0]{
        title,
        goodreadsBookId,
        publishedDate,
        "authors": authors,
        "isbn10": coalesce(isbn10, *[_type == "edition" && book._ref == ^._id && defined(isbn10)][0].isbn10),
        "isbn13": coalesce(isbn13, *[_type == "edition" && book._ref == ^._id && defined(isbn13)][0].isbn13)
      }
    }`,
    {readerId: reader.readerId, bookId},
    {cache: 'no-store'},
  )

  const rating = data?.rating ?? null
  const status = data?.progress?.status ?? null
  const dateRead = data?.progress?.finishedAt ?? null
  const dateAdded = data?.addedAt ?? null
  const readCount = data?.progress?.readCount ?? null
  const importSource = data?.progress?.importSource ?? null
  const visibility: 'private' | 'public' = data?.review?.visibility === 'public' ? 'public' : 'private'
  const review = data?.review?.body?.trim()
    ? {
        body: data.review.body.trim(),
        hasSpoilers: Boolean(data.review.hasSpoilers),
        visibility,
      }
    : null
  const publicationYear = Number(data?.book?.publishedDate?.slice(0, 4))

  return {
    rating,
    status,
    dateRead,
    dateAdded,
    readCount,
    importSource,
    review,
    csv: {
      goodreadsId: data?.book?.goodreadsBookId ?? null,
      title: data?.book?.title ?? null,
      authors: data?.book?.authors?.filter(Boolean) ?? [],
      isbn10: data?.book?.isbn10 ?? null,
      isbn13: data?.book?.isbn13 ?? null,
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
}

export async function getMyBooks() {
  const reader = await requireReader()
  return privateClient.fetch(
    `{
      "shelves": *[_type == "shelf" && owner._ref == $readerId] | order(kind asc, name asc){
        _id,
        name,
        kind,
        "entries": *[_type == "shelfEntry" && shelf._ref == ^._id] | order(addedAt desc){
          _id,
          addedAt,
          "book": book->{
            _id,
            title,
            "slug": coalesce(slug.current, _id),
            publishedDate,
            "myRating": *[_type == "rating" && reader._ref == $readerId && book._ref == ^._id][0].value,
            "percent": *[_type == "readingProgress" && reader._ref == $readerId && book._ref == ^._id][0].percent,
            "authors": authors,
            "cover": coalesce(
              select(defined(coverOverride.asset) => @{${editionCoverFields}}),
              ^.edition->{${editionCoverFields}},
              ${bookCoverProjection}
            )
          }
        }
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

const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const AVATAR_MAX_BYTES = 4 * 1024 * 1024

export async function setProfileAvatar(file: File) {
  const reader = await requireReader()
  if (!AVATAR_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('Please choose an image smaller than 4 MB.')
  const client = writeClient()
  const asset = await client.assets.upload('image', Buffer.from(await file.arrayBuffer()), {
    filename: file.name.replace(/[^\w.-]+/g, '-').slice(0, 80) || 'avatar.jpg',
    contentType: file.type,
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
