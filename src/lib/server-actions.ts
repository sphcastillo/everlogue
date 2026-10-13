'use server'

import {lookupBookEdition, setSelectedEdition, castVote, clearProfileAvatar, createDiscussionPost, joinClub, setBookReview, setProfileAvatar, setRating, setReadingStatus, setSearchReadingStatus, setShelfStatus, setSpaceColor} from './actions'
import {type ReviewFields, type ShelfBook} from './validation'

export async function saveShelfStatusAction(book: ShelfBook, status: string | null) {
  await setShelfStatus(book, status)
}

export async function saveSearchStatusAction(volumeId: string, status: string | null) {
  await setSearchReadingStatus(volumeId, status)
}

export async function saveRatingAction(bookId: string, value: number | null) {
  await setRating(bookId, value)
}

export async function saveReviewAction(
  bookId: string,
  review: ReviewFields | null,
) {
  await setBookReview(bookId, review)
}

export async function saveStatusAction(bookId: string, status: string | null) {
  await setReadingStatus(bookId, status)
}

export async function joinClubAction(clubId: string) {
  await joinClub(clubId)
}

export async function voteAction(pollId: string, bookId: string) {
  await castVote(pollId, bookId)
}

export async function postDiscussionAction(threadId: string, body: string, hasSpoilers: boolean) {
  await createDiscussionPost(threadId, body, hasSpoilers)
}

export async function saveSpaceColorAction(color: string) {
  await setSpaceColor(color)
}

type AvatarActionState = {error?: string}

export async function saveProfileAvatarAction(_prev: AvatarActionState, formData: FormData): Promise<AvatarActionState> {
  try {
    const file = formData.get('avatar')
    if (!(file instanceof Blob) || file.size === 0) return {error: 'Choose an image to upload.'}
    await setProfileAvatar(file)
    return {}
  } catch (caught) {
    return {error: caught instanceof Error ? caught.message : 'Could not upload that image.'}
  }
}

export async function clearProfileAvatarAction(_prev: AvatarActionState, _formData: FormData): Promise<AvatarActionState> {
  try {
    await clearProfileAvatar()
    return {}
  } catch {
    return {error: 'Could not remove the image.'}
  }
}

export async function saveEditionAction(bookId: string, editionId: string | null) {
  try {
    await setSelectedEdition(bookId, editionId)
    return {ok: true as const}
  } catch (error) {
    return {error: error instanceof Error ? error.message : 'Could not save your edition.'}
  }
}

export async function lookupEditionAction(bookId: string, isbn: string) {
  try {
    return await lookupBookEdition(bookId, isbn)
  } catch (error) {
    return {error: error instanceof Error ? error.message : 'Could not look up this ISBN.'}
  }
}
