'use client'

import Link from 'next/link'
import {useEffect, useRef, useState} from 'react'
import type {BookCardData} from './BookCard'
import {BookCover} from './BookCover'

export type ShelfPickBook = BookCardData & {
  pageCount?: number | null
  genres?: {
    _id?: string
    title?: string | null
    slug?: string | null
  }[] | null
}

export type ShelfPickTab = {
  id: string
  label: string
  books: ShelfPickBook[]
}

export function HomePickUpForShelfPicks({
  signedIn,
  tabs,
}: {
  signedIn: boolean
  tabs: ShelfPickTab[]
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')
  const scrollerRef = useRef<HTMLUListElement>(null)
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]

  useEffect(() => {
    scrollerRef.current?.scrollTo({left: 0})
  }, [current?.id])

  function scrollByPage(direction: -1 | 1) {
    const node = scrollerRef.current
    if (!node) return
    node.scrollBy({left: direction * Math.min(node.clientWidth * 0.85, 640), behavior: 'smooth'})
  }

  if (!current) return null

  return (
    <section className="border-t border-(--line) px-5 py-16 min-[875px]:px-9 min-[875px]:pt-20 min-[875px]:pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.62rem] font-medium tracking-[0.2em] text-muted uppercase">
            A few doors worth opening
          </p>
          <h2 className="mt-2 font-display text-[clamp(2rem,12vw,3.35rem)] leading-[0.95] font-black tracking-[-0.06em]">
            Picked for your shelf.
          </h2>
        </div>
        {signedIn ? (
          <Link
            href="/my-books"
            className="inline-flex items-center gap-2 text-[0.68rem] font-medium tracking-[0.16em] text-muted uppercase hover:text-ink"
          >
            See your shelves
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
              <path d="M3 8h9" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4l5 4-5 4" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </Link>
        ) : null}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Shelf picks">
          {tabs.map((tab) => {
            const selected = tab.id === current.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(tab.id)}
                className={`min-h-9 rounded-xs border px-3.5 text-[0.68rem] font-medium tracking-[0.14em] uppercase ${
                  selected ? 'border-ink bg-ink text-white' : 'border-(--line) bg-paper text-ink hover:border-ink'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        {current.books.length > 1 ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-sm border bg-paper text-lg leading-none border-[#d6d6d6]! hover:bg-white"
              aria-label={`Previous books in ${current.label}`}
              onClick={() => scrollByPage(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-sm border bg-paper text-lg leading-none border-[#d6d6d6]! hover:bg-white"
              aria-label={`Next books in ${current.label}`}
              onClick={() => scrollByPage(1)}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {current.books.length ? (
        <ul
          ref={scrollerRef}
          tabIndex={0}
          aria-label={`${current.label} books`}
          className="collection-rail mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:gap-5"
        >
          {current.books.map((book) => (
            <li key={book._id} className="w-33 shrink-0 snap-start sm:w-37">
              <PickCard book={book} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted">
          {current.id === 'forYou'
            ? 'Nothing new to pick yet. Try another row, or add a book from search.'
            : 'This row is still empty. Check back as the catalog grows.'}
        </p>
      )}
    </section>
  )
}

function PickCard({book}: {book: ShelfPickBook}) {
  const href = book.slug ? `/books/${book.slug}` : '#'
  const authors = book.authors?.filter(Boolean).join(', ') || 'Author unknown'
  const genre = book.genres?.find((item) => item.title)?.title
  const rating =
    typeof book.ratingStats?.count === 'number' &&
    book.ratingStats.count > 0 &&
    typeof book.ratingStats.average === 'number'
      ? book.ratingStats.average.toFixed(1)
      : null

  return (
    <article>
      <Link href={href} className="block">
        <BookCover
          cover={book.cover}
          title={book.title}
          className="aspect-2/3 w-full"
          imageWidth={296}
          sizes="148px"
        />
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href} className="block font-medium leading-snug tracking-[-0.01em] hover:underline">
            {book.title}
          </Link>
          <p className="mt-0.5 truncate text-sm text-muted">{authors}</p>

        </div>
        {rating ? <p className="shrink-0 pt-0.5 text-sm text-muted tabular-nums">{rating}</p> : null}
      </div>
    </article>
  )
}
