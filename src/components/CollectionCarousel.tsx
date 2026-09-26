'use client'

import Link from 'next/link'
import {useRef} from 'react'
import {BookCover, type CoverSource} from './BookCover'
import {clubSelectionLabel} from '@/lib/club-selection-dates'
import {collectionTypeLabel} from '@/lib/collection-type'

export type CarouselBook = {
  _id: string
  title: string
  slug?: string | null
  authors?: string[] | null
  googleBooksId?: string | null
  publishedDate?: string | null
  isbn10?: string | null
  isbn13?: string | null
  edition?: CoverSource | null
  coverOverride?: CoverSource['coverOverride']
  cover?: {url?: string | null} | null
}

export type CarouselCollection = {
  _id: string
  title: string
  slug?: string | null
  collectionType?: string | null
  description?: string | null
  curator?: {name?: string | null} | null
  source?: {name?: string | null; url?: string | null} | null
  totalSelections?: number | null
  books: {
    selectionNumber?: number | null
    month?: string | number | null
    year?: number | null
    selectionDate?: string | null
    book?: CarouselBook | null
  }[]
}

function bookHref(book: CarouselBook) {
  return `/books/${book.slug || book._id}`
}

export function CollectionCarousel({collection}: {collection: CarouselCollection}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const entries = collection.books.filter((entry) => entry.book)
  const count = collection.totalSelections || entries.length
  const href = collection.slug ? `/collections/${collection.slug}` : undefined

  function scrollByPage(direction: -1 | 1) {
    const node = scrollerRef.current
    if (!node) return
    node.scrollBy({left: direction * Math.min(node.clientWidth * 0.8, 560), behavior: 'smooth'})
  }

  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2"
      aria-labelledby={`${collection._id}-title`}
    >
      <div className="grid gap-5 pl-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pl-[max(1rem,calc((100vw-80rem)/2))]">
        <div className="flex flex-col gap-5 pr-4 lg:pt-1">
          <div>
            <p className="pill inline-block px-3 py-1 text-xs font-medium uppercase tracking-[0.14em]">
              {collectionTypeLabel(collection.collectionType)}
            </p>
            <h2
              id={`${collection._id}-title`}
              className="mt-4 font-display text-[2.15rem] leading-[1.05] tracking-[-0.03em] sm:text-4xl"
            >
              {collection.title}
            </h2>
            <p className="mt-3 text-sm text-muted">
              {[collection.curator?.name ? `Curated by ${collection.curator.name}` : null, count ? `${count} selections` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {collection.description ? (
              <p className="mt-4 max-w-sm text-[0.98rem] leading-7 text-muted">{collection.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {href ? (
              <Link href={href} className="pill is-active px-4 py-2 text-sm">
                See all {count || ''}
              </Link>
            ) : null}
            {collection.source?.url ? (
              <a href={collection.source.url} className="pill px-4 py-2 text-sm" rel="noreferrer">
                Official list
              </a>
            ) : null}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex justify-end gap-2 pr-4">
            <button
              type="button"
              className="pill grid h-9 w-9 place-items-center text-lg leading-none"
              aria-label={`Previous books in ${collection.title}`}
              onClick={() => scrollByPage(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="pill grid h-9 w-9 place-items-center text-lg leading-none"
              aria-label={`Next books in ${collection.title}`}
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
              aria-label={`${collection.title} books`}
            >
              {entries.map((entry) => {
                const book = entry.book!
                const year = book.publishedDate?.slice(0, 4)
                const selected = clubSelectionLabel(collection, entry)
                return (
                  <Link
                    key={`${collection._id}-${entry.selectionNumber}-${book._id}`}
                    href={bookHref(book)}
                    className="group w-28 shrink-0 sm:w-36"
                  >
                    <div className="relative">
                      {selected ? (
                        <span className="absolute left-1.5 top-1.5 z-10 whitespace-nowrap bg-ink px-1.5 py-0.5 text-[10px] font-medium text-paper">
                          {selected}
                        </span>
                      ) : null}
                      <BookCover
                        cover={book.edition || {...book, coverUrl: book.cover?.url}}
                        title={book.title}
                        className="aspect-2/3 w-full rounded-none"
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-md font-medium leading-snug tracking-[-0.01em]">{book.title}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {book.authors?.filter(Boolean).join(', ') || 'Author unknown'}
                    </p>
                    {/* {year ? <p className="mt-0.5 text-xs text-muted">{year}</p> : null} */}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
