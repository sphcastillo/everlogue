'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'
import {LibraryBookCover} from './LibraryBookCover'
import type {CoverSource} from './BookCover'

export type LibraryBook = {
  _id: string
  title: string
  slug?: string | null
  authors?: string[] | null
  cover?: CoverSource | null
  myRating?: number | null
  percent?: number | null
}

export type LibraryShelf = {
  _id: string
  name: string
  kind: string
  entries?: {book?: LibraryBook | null}[]
}

type Filter = 'all' | 'currentlyReading' | 'finished' | 'wantToRead'
type View = 'grid' | 'list'

const FILTERS: {id: Filter; label: string}[] = [
  {id: 'all', label: 'All books'},
  {id: 'currentlyReading', label: 'Currently reading'},
  {id: 'finished', label: 'Read'},
  {id: 'wantToRead', label: 'Want to read'},
]

const SECTIONS: {
  kind: Exclude<Filter, 'all'>
  title: string
  note: string
}[] = [
  {kind: 'currentlyReading', title: 'Currently Reading', note: 'Midway through, not in a hurry'},
  {kind: 'finished', title: 'Read', note: 'Finished, remembered, kept'},
  {kind: 'wantToRead', title: 'Want to Read', note: 'The next chapter starts here'},
]

function pad(count: number) {
  return String(count).padStart(2, '0')
}

function booksOn(shelf?: LibraryShelf | null) {
  return (shelf?.entries || []).flatMap((entry) => (entry.book ? [entry.book] : []))
}

function matchesQuery(book: LibraryBook, query: string) {
  if (!query) return true
  const haystack = `${book.title} ${book.authors?.join(' ') || ''}`.toLowerCase()
  return haystack.includes(query)
}

function formatRating(value: number) {
  return `${value.toFixed(1)} / 5`
}

export function MyBooksLibrary({shelves}: {shelves: LibraryShelf[]}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('grid')
  const [query, setQuery] = useState('')

  const byKind = useMemo(() => {
    const map = new Map<string, LibraryShelf>()
    for (const shelf of shelves) map.set(shelf.kind, shelf)
    return map
  }, [shelves])

  const counts = {
    currentlyReading: booksOn(byKind.get('currentlyReading')).length,
    finished: booksOn(byKind.get('finished')).length,
    wantToRead: booksOn(byKind.get('wantToRead')).length,
  }
  const needle = query.trim().toLowerCase()
  const customShelves = shelves.filter((shelf) => shelf.kind === 'custom')
  const visibleSections = SECTIONS.filter((section) => filter === 'all' || filter === section.kind)

  return (
    <div className="px-5 pb-20 sm:px-8 lg:px-9">
      <header className="flex flex-wrap items-end justify-between gap-8 pt-8 pb-8">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
              <path d="M3 3.5h6.5A2.5 2.5 0 0 1 12 6v7H5.2A2.2 2.2 0 0 0 3 15.2V3.5Z" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6.2 3.5V15" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            A record of your reading life
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,4.6rem)] leading-[0.88] font-black tracking-[-0.07em]">
            My books.
          </h1>
          <p className="mt-4 max-w-md text-[1.02rem] leading-7 text-muted">
            Everything you&apos;re reading, everything you&apos;ve finished, and everything still to come.
          </p>
        </div>
        <dl className="flex gap-8 sm:gap-12">
          {(
            [
              {label: 'Currently reading', value: counts.currentlyReading},
              {label: 'Read', value: counts.finished},
              {label: 'Want to read', value: counts.wantToRead},
            ] as const
          ).map((stat) => (
            <div key={stat.label} className="text-right">
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(stat.value)}</dd>
              <p className="mt-2 font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">{stat.label}</p>
            </div>
          ))}
        </dl>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-(--line) py-4">
        <nav className="flex flex-wrap items-center gap-1" aria-label="Shelf filters">
          {FILTERS.map((item) => {
            const active = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.id)}
                className={`relative px-3 py-2 font-mono text-[11px] font-medium tracking-[0.16em] uppercase ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {item.label}
                {active ? <span className="absolute inset-x-3 -bottom-4 h-px bg-ink" /> : null}
              </button>
            )
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search your library</span>
            <svg viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.4 10.4 13 13" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your library"
              className="h-10 w-52 border bg-paper pr-3 pl-9 text-sm border-[#d6d6d6]! placeholder:text-muted"
            />
          </label>
          <div className="flex">
            <button
              type="button"
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
              onClick={() => setView('grid')}
              className={`grid size-10 place-items-center border border-[#d6d6d6]! ${view === 'grid' ? 'bg-ink text-white' : 'bg-paper text-ink'}`}
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden="true">
                <rect x="2" y="2" width="5" height="5" />
                <rect x="9" y="2" width="5" height="5" />
                <rect x="2" y="9" width="5" height="5" />
                <rect x="9" y="9" width="5" height="5" />
              </svg>
            </button>
            <button
              type="button"
              aria-pressed={view === 'list'}
              aria-label="List view"
              onClick={() => setView('list')}
              className={`grid size-10 place-items-center border-y border-r border-[#d6d6d6]! ${view === 'list' ? 'bg-ink text-white' : 'bg-paper text-ink'}`}
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </div>
          <Link
            href="/discover"
            className="inline-flex h-10 items-center gap-2 bg-ink px-4 font-mono text-[11px] font-medium tracking-[0.14em] text-white uppercase"
          >
            <span aria-hidden="true">+</span>
            Add book
          </Link>
        </div>
      </div>

      <div className="space-y-14 pt-10">
        {visibleSections.map((section) => {
          const books = booksOn(byKind.get(section.kind)).filter((book) => matchesQuery(book, needle))
          return (
            <ShelfSection
              key={section.kind}
              title={section.title}
              count={books.length}
              note={section.note}
              books={books}
              view={view}
              showProgress={section.kind === 'currentlyReading'}
              showRating={section.kind === 'finished'}
            />
          )
        })}
        {filter === 'all'
          ? customShelves.map((shelf) => {
              const books = booksOn(shelf).filter((book) => matchesQuery(book, needle))
              return (
                <ShelfSection
                  key={shelf._id}
                  title={shelf.name}
                  count={books.length}
                  books={books}
                  view={view}
                  showRating
                />
              )
            })
          : null}
      </div>
    </div>
  )
}

function ShelfSection({
  title,
  count,
  note,
  books,
  view,
  showProgress = false,
  showRating = false,
}: {
  title: string
  count: number
  note?: string
  books: LibraryBook[]
  view: View
  showProgress?: boolean
  showRating?: boolean
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-(--line) pb-3">
        <h2 className="flex items-baseline gap-3 font-display text-[1.45rem] leading-none font-black tracking-[-0.04em]">
          {title}
          <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{pad(count)}</span>
        </h2>
        {note ? <p className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">{note}</p> : null}
      </div>
      {books.length ? (
        <ul className={view === 'grid' ? 'mt-6 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' : 'mt-6 divide-y divide-(--line)'}>
          {books.map((book) => (
            <li key={book._id}>
              <LibraryBookCard
                book={book}
                view={view}
                showProgress={showProgress}
                showRating={showRating}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted">Nothing on this shelf yet.</p>
      )}
    </section>
  )
}

function LibraryBookCard({
  book,
  view,
  showProgress,
  showRating,
}: {
  book: LibraryBook
  view: View
  showProgress: boolean
  showRating: boolean
}) {
  const href = book.slug ? `/books/${book.slug}` : '#'
  const authors = book.authors?.filter(Boolean).join(', ') || 'Author unknown'
  const percent = typeof book.percent === 'number' ? Math.min(100, Math.max(0, book.percent)) : null

  if (view === 'list') {
    return (
      <Link href={href} className="group flex items-center gap-4 py-3">
        <LibraryBookCover bookId={book._id} cover={book.cover} title={book.title} className="aspect-2/3 w-12 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{book.title}</span>
          <span className="mt-0.5 block truncate text-sm text-muted">{authors}</span>
        </span>
        {showRating && typeof book.myRating === 'number' ? (
          <span className="shrink-0 text-sm text-muted">★ {formatRating(book.myRating)}</span>
        ) : null}
        {showProgress && percent !== null ? <span className="shrink-0 text-sm text-muted">{Math.round(percent)}%</span> : null}
      </Link>
    )
  }

  return (
    <Link href={href} className="group block">
      <LibraryBookCover bookId={book._id} cover={book.cover} title={book.title} className="aspect-2/3 w-full" />
      <p className="mt-3 line-clamp-2 text-[0.95rem] leading-snug font-medium tracking-[-0.01em]">{book.title}</p>
      <p className="mt-0.5 truncate text-sm text-muted">{authors}</p>
      {showProgress && percent !== null ? (
        <p className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
          <span className="tabular-nums">{Math.round(percent)}%</span>
          <span className="relative h-0.75 min-w-16 flex-1 bg-[#e4e4e4]">
            <span className="absolute inset-y-0 left-0 bg-ink" style={{width: `${percent}%`}} />
          </span>
        </p>
      ) : null}
      {showRating && typeof book.myRating === 'number' ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
          <span aria-hidden="true">★</span>
          <span>{formatRating(book.myRating)}</span>
        </p>
      ) : null}
    </Link>
  )
}
