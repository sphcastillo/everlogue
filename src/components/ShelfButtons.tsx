'use client'

import {SignInButton} from '@clerk/nextjs'
import {Fragment, useOptimistic, useState, useTransition} from 'react'
import {saveShelfStatusAction} from '@/lib/server-actions'
import type {ReadingPeriod, ShelfBook} from '@/lib/validation'

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

type DatePrecision = 'year' | 'month' | 'day'

function datePrecision(value?: string | null): DatePrecision {
  return value?.length === 4 ? 'year' : value?.length === 7 ? 'month' : 'day'
}

function dateForPrecision(value: string, precision: DatePrecision) {
  if (precision === 'year') return value.slice(0, 4)
  if (precision === 'month') return value.length >= 7 ? value.slice(0, 7) : `${value.slice(0, 4)}-01`
  if (value.length === 10) return value
  if (value.length === 7) return `${value}-01`
  return `${value.slice(0, 4)}-01-01`
}

function PartialDateInput({
  value,
  precision,
  max,
  disabled,
  onChange,
}: {
  value: string
  precision: DatePrecision
  max: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <input
      type={precision === 'year' ? 'number' : precision === 'month' ? 'month' : 'date'}
      inputMode={precision === 'year' ? 'numeric' : undefined}
      min={precision === 'year' ? 1000 : undefined}
      max={precision === 'year' ? Number(max.slice(0, 4)) : max.slice(0, precision === 'month' ? 7 : 10)}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 border border-[#d6d6d6] bg-white px-3 text-sm text-ink"
    />
  )
}

type ShelfButtonsProps = {
  status: string | null
  readingPeriod?: ReadingPeriod | null
  signedIn: boolean
  onStatusChange?: (status: string | null) => void
} & ({bookId: string; googleBooksId?: never} | {bookId?: never; googleBooksId: string})

export function ShelfButtons({
  bookId,
  googleBooksId,
  status,
  readingPeriod,
  signedIn,
  onStatusChange,
}: ShelfButtonsProps) {
  const [pending, start] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(status)
  const [error, setError] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const [precision, setPrecision] = useState<DatePrecision>(datePrecision(readingPeriod?.end))
  const [finishedOn, setFinishedOn] = useState(readingPeriod?.end || today)
  const [includeStart, setIncludeStart] = useState(Boolean(readingPeriod?.start))
  const [startedOn, setStartedOn] = useState(readingPeriod?.start || today)
  const [showReadDate, setShowReadDate] = useState(status === 'finished')
  const invalidRange = includeStart && Boolean(startedOn) && Boolean(finishedOn) && startedOn > finishedOn

  function choose(next: string | null, nextReadingPeriod?: ReadingPeriod) {
    if (!signedIn) return
    start(async () => {
      setError(null)
      setOptimistic(next)
      try {
        const book: ShelfBook = googleBooksId !== undefined
          ? {source: 'googleBooks', id: googleBooksId}
          : {source: 'catalog', id: bookId!}
        await saveShelfStatusAction(book, next, nextReadingPeriod)
        setShowReadDate(next === 'finished')
        onStatusChange?.(next)
      } catch {
        setOptimistic(status)
        setError('This book couldn’t be saved. Please try again.')
      }
    })
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3" aria-busy={pending}>
        {OPTIONS.map((option) => {
          const selected = optimistic === option.value
          const button = (
            <button
              type="button"
              disabled={pending}
              aria-pressed={selected}
              onClick={() => {
                if (option.value === 'finished') {
                  setShowReadDate(true)
                  return
                }
                choose(selected ? null : option.value)
              }}
              className={`inline-flex min-h-14 items-center justify-center gap-2 border px-3 font-mono text-[0.62rem] font-medium tracking-[0.14em] uppercase disabled:opacity-50 ${
                selected
                  ? 'border-ink! bg-ink! text-white'
                  : 'border-[#d6d6d6]! bg-paper text-ink hover:bg-white'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          )
          return signedIn ? (
            <Fragment key={option.value}>{button}</Fragment>
          ) : (
            <SignInButton key={option.value} mode="modal">
              {button}
            </SignInButton>
          )
        })}
      </div>
      {signedIn && showReadDate ? (
        <div className="mt-3 border border-(--line) bg-paper p-4">
          <fieldset>
            <legend className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
              How precise is the date?
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {([
                ['year', 'Year'],
                ['month', 'Month & year'],
                ['day', 'Exact day'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={pending}
                  aria-pressed={precision === value}
                  onClick={() => {
                    setPrecision(value)
                    setFinishedOn(current => dateForPrecision(current || today, value))
                    setStartedOn(current => dateForPrecision(current || today, value))
                  }}
                  className={`min-h-9 border px-3 font-mono text-[10px] font-medium tracking-[0.12em] uppercase disabled:opacity-50 ${
                    precision === value ? 'border-ink bg-ink text-white' : 'border-[#d6d6d6] bg-white text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            {includeStart ? (
              <label className="grid gap-1.5">
                <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">Started</span>
                <PartialDateInput
                  value={startedOn}
                  precision={precision}
                  max={today}
                  disabled={pending}
                  onChange={setStartedOn}
                />
              </label>
            ) : null}
            <label className="grid gap-1.5">
              <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
                {includeStart ? 'Finished' : 'Date read'}
              </span>
              <PartialDateInput
                value={finishedOn}
                precision={precision}
                max={today}
                disabled={pending}
                onChange={setFinishedOn}
              />
            </label>
          </div>

          <label className="mt-3 flex w-fit items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={includeStart}
              disabled={pending}
              onChange={(event) => setIncludeStart(event.target.checked)}
            />
            Add when I started
          </label>
          {invalidRange ? <p className="mt-2 text-sm text-(--palette-clay)">Started must be before Finished.</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || !finishedOn || invalidRange || (includeStart && !startedOn)}
              onClick={() => choose('finished', {
                ...(includeStart ? {start: startedOn} : {}),
                end: finishedOn,
              })}
              className="min-h-10 bg-ink px-4 font-mono text-[10px] font-medium tracking-[0.14em] text-white uppercase disabled:opacity-50"
            >
              {optimistic === 'finished' ? 'Save dates' : 'Save as read'}
            </button>
            {optimistic === 'finished' ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(null)}
                className="min-h-10 px-2 font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase hover:text-ink disabled:opacity-50"
              >
                Remove from Read
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowReadDate(false)}
                className="min-h-10 px-2 font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-muted">{error}</p> : null}
    </div>
  )
}
