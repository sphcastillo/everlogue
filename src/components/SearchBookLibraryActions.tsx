'use client'

import {useState} from 'react'
import {ShelfButtons} from './ShelfButtons'
import {StarRating} from './StarRating'
import type {ReadingPeriod} from '@/lib/validation'

export function SearchBookLibraryActions({
  catalogBookId,
  googleBooksId,
  signedIn,
  status,
  readingPeriod,
  rating,
}: {
  catalogBookId?: string | null
  googleBooksId: string
  signedIn: boolean
  status: string | null
  readingPeriod?: ReadingPeriod | null
  rating: number | null
}) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [bookId, setBookId] = useState(catalogBookId ?? null)
  const canRate = signedIn && Boolean(bookId) && (
    currentStatus === 'currentlyReading' || currentStatus === 'finished'
  )

  return (
    <>
      <ShelfButtons
        {...(catalogBookId ? {bookId: catalogBookId} : {googleBooksId})}
        status={currentStatus}
        readingPeriod={readingPeriod}
        signedIn={signedIn}
        onStatusChange={(nextStatus, savedBookId) => {
          setCurrentStatus(nextStatus)
          if (savedBookId) setBookId(savedBookId)
        }}
      />
      {canRate && bookId ? (
        <div className="mt-8 border-t border-(--line) pt-6">
          <StarRating bookId={bookId} value={rating} signedIn />
        </div>
      ) : null}
    </>
  )
}
