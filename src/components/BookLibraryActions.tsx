'use client'

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

  return (
    <>
      <ShelfButtons bookId={bookId} status={shelf} signedIn={signedIn} onStatusChange={setShelf} />
      <div className="mt-8">
        <StarRating bookId={bookId} value={rating} signedIn={signedIn} />
      </div>
      {signedIn && finished ? <BookReviewForm bookId={bookId} review={review} /> : null}
      {signedIn && !finished ? (
        <p className="mt-8 text-sm text-muted">Mark this book as Read to leave a review.</p>
      ) : null}
    </>
  )
}
