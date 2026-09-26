'use server'

import {castVote, createDiscussionPost, joinClub, setRating, setReadingStatus, setSpaceColor} from './actions'

export async function saveRatingAction(bookId: string, value: number | null) {
  await setRating(bookId, value)
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
