'use client'

import {useId, useOptimistic, useState, useTransition} from 'react'
import {saveRatingAction} from '@/lib/server-actions'
import {HALF_STARS} from '@/lib/validation'

type HalfStar = (typeof HALF_STARS)[number]

const STAR_PATH =
  'M12 2.6 14.7 9l6.8.6-5.2 4.5 1.6 6.6L12 17.8 6.1 20.7 7.7 14.1 2.5 9.6 9.3 9z'

function fillFor(star: number, value: number | null) {
  if (value === null || Number.isNaN(value)) return 0
  if (value >= star) return 1
  if (value >= star - 0.5) return 0.5
  return 0
}

function formatRating(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function StarGlyph({fill, clipId}: {fill: 0 | 0.5 | 1; clipId: string}) {
  return (
    <svg viewBox="0 0 24 24" className="star-glyph" aria-hidden="true">
      {fill === 0.5 ? (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
      ) : null}
      <path d={STAR_PATH} className="star-glyph-empty" />
      {fill > 0 ? (
        <path
          d={STAR_PATH}
          className="star-glyph-fill"
          clipPath={fill === 0.5 ? `url(#${clipId})` : undefined}
        />
      ) : null}
    </svg>
  )
}

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
        className="mt-3 flex items-center gap-0.5"
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
      <p className="mt-2 text-[11px] text-muted">Left side of a star is a half. Right side is the full star.</p>
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
