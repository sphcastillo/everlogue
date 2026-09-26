'use client'

import {useOptimistic, useTransition} from 'react'
import {saveRatingAction} from '@/lib/server-actions'
import {HALF_STARS} from '@/lib/validation'

export function StarRating({
  bookId,
  value,
  signedIn,
}: {
  bookId: string
  value: number | null
  signedIn: boolean
}) {
  const [pending, start] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(value)

  function choose(next: number | null) {
    if (!signedIn) return
    start(async () => {
      setOptimistic(next)
      await saveRatingAction(bookId, next)
    })
  }

  return (
    <div className="surface p-5">
      <p className="text-sm text-[var(--muted)]">Your rating</p>
      <div role="radiogroup" aria-label="Half-star rating" className="mt-3 flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const halfValue = (star - 0.5) as (typeof HALF_STARS)[number]
          const fullValue = star as (typeof HALF_STARS)[number]
          const full = optimistic !== null && optimistic >= star
          const half = optimistic === star - 0.5
          return (
            <span key={star} className="star-pair">
              <button
                type="button"
                role="radio"
                aria-checked={optimistic === halfValue}
                aria-label={`${halfValue} stars`}
                className="half left"
                disabled={!signedIn || pending}
                onClick={() => choose(halfValue)}
              />
              <button
                type="button"
                role="radio"
                aria-checked={optimistic === fullValue}
                aria-label={`${fullValue} star${fullValue === 1 ? '' : 's'}`}
                className="half right"
                disabled={!signedIn || pending}
                onClick={() => choose(fullValue)}
              />
              <span className={`star-glyph ${full ? 'is-full' : half ? 'is-half' : ''}`} aria-hidden>
                ★
              </span>
            </span>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <p className="text-[var(--muted)]">
          {optimistic === null ? 'Unrated — not the same as zero' : `${optimistic} stars`}
        </p>
        <button
          type="button"
          className="text-[var(--accent)] disabled:opacity-40"
          disabled={!signedIn || pending || optimistic === null}
          onClick={() => choose(null)}
        >
          Clear rating
        </button>
      </div>
      {!signedIn ? <p className="mt-2 text-sm text-[var(--muted)]">Sign in to save a rating to your shelves.</p> : null}
    </div>
  )
}
