'use server'

import {castVote, clearProfileAvatar, createDiscussionPost, joinClub, setBookReview, setProfileAvatar, setRating, setReadingStatus, setSearchReadingStatus, setSpaceColor} from './actions'
import {shelfBookSchema, type ReviewFields, type ShelfBook} from './validation'

export async function saveShelfStatusAction(book: ShelfBook, status: string | null) {
  const target = shelfBookSchema.parse(book)
  if (target.source === 'googleBooks') await setSearchReadingStatus(target.id, status)
  else await setReadingStatus(target.id, status)
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
