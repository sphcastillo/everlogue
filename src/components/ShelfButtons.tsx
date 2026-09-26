'use client'

import {useOptimistic, useTransition} from 'react'
import {saveStatusAction} from '@/lib/server-actions'

const OPTIONS = [
  {value: 'wantToRead', label: 'Want to Read'},
  {value: 'currentlyReading', label: 'Currently Reading'},
  {value: 'finished', label: 'Read'},
] as const

export function ShelfButtons({
  bookId,
  status,
  signedIn,
}: {
  bookId: string
  status: string | null
  signedIn: boolean
}) {
  const [pending, start] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(status)

  function choose(next: string | null) {
    if (!signedIn) return
    start(async () => {
      setOptimistic(next)
      await saveStatusAction(bookId, next)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const selected = optimistic === option.value
        return (
          <button
            key={option.value}
            type="button"
            disabled={!signedIn || pending}
            aria-pressed={selected}
            onClick={() => choose(selected ? null : option.value)}
            className="pill px-4 py-2 text-sm"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
