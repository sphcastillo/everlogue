'use client'

import {useState, useTransition} from 'react'
import {saveReviewAction} from '@/lib/server-actions'

export type BookReviewValue = {
  body: string
  hasSpoilers: boolean
  visibility: 'private' | 'public'
}

export function BookReviewForm({
  bookId,
  review,
}: {
  bookId: string
  review: BookReviewValue | null
}) {
  const [pending, start] = useTransition()
  const [body, setBody] = useState(review?.body ?? '')
  const [hasSpoilers, setHasSpoilers] = useState(Boolean(review?.hasSpoilers))
  const [visibility, setVisibility] = useState<'private' | 'public'>(review?.visibility ?? 'private')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(Boolean(review?.body))
  const hasReview = saved && body.trim().length > 0

  function persist(next: BookReviewValue | null) {
    setError(null)
    start(async () => {
      try {
        await saveReviewAction(bookId, next)
        setSaved(Boolean(next))
        if (!next) {
          setBody('')
          setHasSpoilers(false)
          setVisibility('private')
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'This review couldn’t be saved.')
      }
    })
  }

  return (
    <form
      className="mt-8"
      onSubmit={(event) => {
        event.preventDefault()
        persist({body, hasSpoilers, visibility})
      }}
    >
      <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Your review</p>
      <p className="mt-1 max-w-md text-sm text-muted">
        You finished it. Leave a note for yourself, or share it with other readers.
      </p>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={6}
        maxLength={8000}
        required
        placeholder="What stayed with you?"
        className="mt-4 w-full border bg-paper px-3 py-3 text-sm leading-relaxed border-[#d6d6d6]! outline-none focus:border-ink"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasSpoilers}
            onChange={(event) => setHasSpoilers(event.target.checked)}
          />
          This review has spoilers
        </label>
        <fieldset className="flex items-center gap-4 text-sm">
          <legend className="sr-only">Who can read this review</legend>
          {(['private', 'public'] as const).map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name="review-visibility"
                checked={visibility === option}
                onChange={() => setVisibility(option)}
              />
              {option === 'private' ? 'Only me' : 'Public'}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="inline-flex h-10 items-center bg-ink px-4 font-mono text-[11px] font-medium tracking-[0.14em] text-white uppercase disabled:opacity-50"
        >
          {pending ? 'Saving…' : hasReview ? 'Update review' : 'Save review'}
        </button>
        {hasReview ? (
          <button
            type="button"
            disabled={pending}
            className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted uppercase hover:text-ink disabled:opacity-40"
            onClick={() => persist(null)}
          >
            Remove review
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-muted">{error}</p> : null}
    </form>
  )
}
