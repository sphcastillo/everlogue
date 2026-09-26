'use client'

import {useRef} from 'react'
import {BookCard, type BookCardData} from './BookCard'

export function ShelfCarousel({
  id,
  title,
  description,
  books,
}: {
  id: string
  title: string
  description?: string
  books: BookCardData[]
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const count = books.length

  function scrollByPage(direction: -1 | 1) {
    const node = scrollerRef.current
    if (!node) return
    node.scrollBy({left: direction * Math.min(node.clientWidth * 0.8, 560), behavior: 'smooth'})
  }

  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2"
      aria-labelledby={`${id}-title`}
    >
      <div className="grid gap-5 pl-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pl-[max(1rem,calc((100vw-80rem)/2))]">
        <div className="flex flex-col gap-5 pr-4 lg:pt-1">
          <div>
            <p className="pill inline-block px-3 py-1 text-xs font-medium uppercase tracking-[0.14em]">
              Your shelves
            </p>
            <h2
              id={`${id}-title`}
              className="mt-4 font-[family-name:var(--font-display)] text-[2.15rem] leading-[1.05] tracking-[-0.03em] sm:text-4xl"
            >
              {title}
            </h2>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {count ? `${count} ${count === 1 ? 'book' : 'books'}` : 'Nothing here yet'}
            </p>
            {description ? (
              <p className="mt-4 max-w-sm text-[0.98rem] leading-7 text-[var(--muted)]">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="min-w-0">
          {count ? (
            <>
              <div className="mb-3 flex justify-end gap-2 pr-4">
                <button
                  type="button"
                  className="pill grid h-9 w-9 place-items-center text-lg leading-none"
                  aria-label={`Previous books in ${title}`}
                  onClick={() => scrollByPage(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="pill grid h-9 w-9 place-items-center text-lg leading-none"
                  aria-label={`Next books in ${title}`}
                  onClick={() => scrollByPage(1)}
                >
                  ›
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[var(--paper)] to-transparent" />
                <div
                  ref={scrollerRef}
                  className="collection-rail flex gap-3 overflow-x-auto pb-2"
                  tabIndex={0}
                  aria-label={`${title} books`}
                >
                  {books.map((book) => (
                    <BookCard key={book._id} book={book} compact resolveMissingCover />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="pr-4 pt-2 text-sm leading-7 text-[var(--muted)]">
              Add a book from its page. Your shelves stay private.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
