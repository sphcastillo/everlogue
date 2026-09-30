'use server'

import {castVote, clearProfileAvatar, createDiscussionPost, joinClub, setBookReview, setProfileAvatar, setRating, setReadingStatus, setSearchReadingStatus, setSpaceColor} from './actions'
import {shelfBookSchema, type ShelfBook} from './validation'

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
  review: {body: string; hasSpoilers: boolean; visibility: 'private' | 'public'} | null,
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

export async function saveProfileAvatarAction(formData: FormData) {
  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose an image to upload.')
  await setProfileAvatar(file)
}

export async function clearProfileAvatarAction() {
  await clearProfileAvatar()
}
