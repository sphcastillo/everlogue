'use client'

import {useId, useOptimistic, useState, useTransition} from 'react'
import {saveRatingAction} from '@/lib/server-actions'
import {HALF_STARS} from '@/lib/validation'
import {fillFor, formatRating, StarGlyph} from './StarDisplay'

type HalfStar = (typeof HALF_STARS)[number]

export function StarRating({
  bookId,
  value,
  signedIn,
}: {
  bookId: string
  value: number | null
  signedIn: boolean
}) {
  const id = useId().replace(/:/g, '')
  const [pending, start] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(value == null ? null : Number(value))
  const [preview, setPreview] = useState<number | null>(null)
  const shown = preview ?? optimistic

  function choose(next: number | null) {
    if (!signedIn) return
    setPreview(null)
    start(async () => {
      setOptimistic(next)
      await saveRatingAction(bookId, next)
    })
  }

  return (
    <div>
      <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Your rating</p>
      <div
        role="radiogroup"
        aria-label="Rating in half-star steps, from 0.5 to 5"
        className="mt-3 grid grid-cols-5 gap-1.5 sm:hidden"
      >
        {HALF_STARS.map((rating) => (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={optimistic === rating}
            aria-label={`${formatRating(rating)} stars`}
            disabled={!signedIn || pending}
            onClick={() => choose(rating)}
            className={`min-h-11 rounded-xs border font-mono text-[11px] font-medium disabled:opacity-40 ${
              optimistic === rating
                ? 'border-ink bg-ink text-white'
                : 'border-(--line) bg-paper text-ink active:border-ink'
            }`}
          >
            {formatRating(rating)} ★
          </button>
        ))}
      </div>
      <div
        role="radiogroup"
        aria-label="Rating in half-star steps, from 0.5 to 5"
        className="mt-3 hidden items-center gap-0.5 sm:flex"
        onPointerLeave={() => setPreview(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const halfValue = (star - 0.5) as HalfStar
          const fullValue = star as HalfStar
          const fill = fillFor(star, shown) as 0 | 0.5 | 1
          return (
            <span key={star} className="star-pair">
              <button
                type="button"
                role="radio"
                aria-checked={optimistic === halfValue}
                aria-label={`${formatRating(halfValue)} stars`}
                title={`${formatRating(halfValue)} stars`}
                className="half left"
                disabled={!signedIn || pending}
                onPointerEnter={() => signedIn && setPreview(halfValue)}
                onClick={() => choose(halfValue)}
              />
              <button
                type="button"
                role="radio"
                aria-checked={optimistic === fullValue}
                aria-label={`${fullValue} star${fullValue === 1 ? '' : 's'}`}
                title={`${fullValue} star${fullValue === 1 ? '' : 's'}`}
                className="half right"
                disabled={!signedIn || pending}
                onPointerEnter={() => signedIn && setPreview(fullValue)}
                onClick={() => choose(fullValue)}
              />
              <StarGlyph fill={fill} clipId={`${id}-half-${star}`} />
            </span>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted sm:hidden">Choose any rating in half-star steps.</p>
      <p className="mt-2 hidden text-[11px] text-muted sm:block">
        Left side of a star is a half. Right side is the full star.
      </p>
      <div className="mt-3 flex max-w-md items-center justify-between gap-4 text-sm">
        <p className="text-muted">
          {shown === null ? 'Unrated — not the same as zero' : `${formatRating(shown)} stars`}
        </p>
        <button
          type="button"
          className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted uppercase disabled:opacity-40 hover:text-ink"
          disabled={!signedIn || pending || optimistic === null}
          onClick={() => choose(null)}
        >
          Clear rating
        </button>
      </div>
    </div>
  )
}
