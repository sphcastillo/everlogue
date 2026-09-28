'use client'

import {useOptimistic, useTransition} from 'react'
import {saveStatusAction} from '@/lib/server-actions'

const OPTIONS = [
  {
    value: 'wantToRead',
    label: 'Want to read',
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5.2V8l1.8 1.8" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    value: 'currentlyReading',
    label: 'Currently reading',
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
        <path d="M3 3.5h6.5A2.5 2.5 0 0 1 12 6v7H5.2A2.2 2.2 0 0 0 3 15.2V3.5Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6.2 3.5V15" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    value: 'finished',
    label: 'Read',
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
        <path d="M3.5 8.2 6.4 11l6.1-6.4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
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
    <div className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map((option) => {
        const selected = optimistic === option.value
        return (
          <button
            key={option.value}
            type="button"
            disabled={!signedIn || pending}
            aria-pressed={selected}
            onClick={() => choose(selected ? null : option.value)}
            className={`inline-flex min-h-14 items-center justify-center gap-2 border px-3 font-mono text-[0.62rem] font-medium tracking-[0.14em] uppercase border-[#d6d6d6]! disabled:opacity-50 ${
              selected ? 'bg-ink text-white' : 'bg-paper text-ink hover:bg-white'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
