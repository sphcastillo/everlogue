'use client'

import {SignInButton} from '@clerk/nextjs'
import {useState} from 'react'
import {BookReviewForm, type BookReviewValue} from './BookReviewForm'
import {ShelfButtons} from './ShelfButtons'
import {StarRating} from './StarRating'

export function BookLibraryActions({
  bookId,
  signedIn,
  status,
  rating,
  review,
}: {
  bookId: string
  signedIn: boolean
  status: string | null
  rating: number | null
  review: BookReviewValue | null
}) {
  const [shelf, setShelf] = useState(status)
  const finished = shelf === 'finished'
  const canRate = signedIn && (shelf === 'currentlyReading' || finished)

  return (
    <>
      <ShelfButtons bookId={bookId} status={shelf} signedIn={signedIn} onStatusChange={setShelf} />
      {!signedIn ? (
        <div className="mt-5 flex flex-col gap-4 border border-(--line) bg-paper p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center border border-(--line) text-muted" aria-hidden="true">
              <svg viewBox="0 0 16 16" className="size-4" fill="none">
                <path d="M2.5 3.5h3A2.5 2.5 0 0 1 8 6v7.5a2.5 2.5 0 0 0-2.5-2.5h-3V3.5Z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M13.5 3.5h-3A2.5 2.5 0 0 0 8 6v7.5a2.5 2.5 0 0 1 2.5-2.5h3V3.5Z" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </span>
            <div>
              <p className="font-medium text-ink">Sign in to save this book</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted">
                Keep your shelves, ratings, and reviews with your Everlogue account.
              </p>
            </div>
          </div>
          <SignInButton mode="modal">
            <button
              type="button"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 bg-ink px-4 font-mono text-[10px] font-medium tracking-[0.14em] text-white uppercase"
            >
              Sign in
              <span aria-hidden="true">→</span>
            </button>
          </SignInButton>
        </div>
      ) : null}
      {canRate ? (
        <div className="mt-8">
          <StarRating bookId={bookId} value={rating} signedIn />
        </div>
      ) : signedIn ? (
        <p className="mt-8 text-sm text-muted">
          Mark this book as Currently Reading or Read to rate it.
        </p>
      ) : null}
      {signedIn && finished ? <BookReviewForm bookId={bookId} review={review} /> : null}
      {canRate && !finished ? (
        <p className="mt-8 text-sm text-muted">Mark this book as Read to leave a review.</p>
      ) : null}
    </>
  )
}
