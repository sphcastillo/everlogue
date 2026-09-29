'use client'

import Link from 'next/link'
import {useRef} from 'react'
import {catalogCover} from '@/lib/book-covers'
import {latestClubEntries} from '@/lib/club-books'
import {clubInitials} from '@/lib/club-title'
import type {ClubImage} from '@/sanity/image'
import {BookCover, type CoverSource} from './BookCover'
import {ClubMark} from './ClubMark'

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
  description?: string | null
}

export type CarouselCollection = {
  _id: string
  title: string
  slug?: string | null
  collectionType?: string | null
  description?: string | null
  curator?: {name?: string | null} | null
  image?: ClubImage
  instagramUrl?: string | null
  source?: {name?: string | null; url?: string | null} | null
  totalSelections?: number | null
  books: {
    selectionNumber?: number | null
    isLatestAddition?: boolean | null
    month?: string | number | null
    year?: number | null
    selectionDate?: string | null
    book?: CarouselBook | null
  }[]
}

function bookHref(book: CarouselBook, clubSlug?: string | null) {
  const path = `/books/${book.slug || book._id}`
  return clubSlug ? `${path}?club=${encodeURIComponent(clubSlug)}` : path
}

const control =
  'grid size-9 place-items-center rounded-sm border bg-paper text-lg leading-none border-[#d6d6d6]! hover:bg-white'

export function CollectionCarousel({collection}: {collection: CarouselCollection}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const allEntries = latestClubEntries(collection.books)
  const entries = allEntries.slice(0, 24)
  const count = collection.totalSelections ?? allEntries.length
  const href = collection.slug ? `/collections/${collection.slug}` : undefined
  const curator = collection.curator?.name
  const instagramUrl = collection.instagramUrl

  function scrollByPage(direction: -1 | 1) {
    const node = scrollerRef.current
    if (!node) return
    node.scrollBy({left: direction * Math.min(node.clientWidth * 0.8, 720), behavior: 'smooth'})
  }

  return (
    <section aria-labelledby={`${collection._id}-title`}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-3">
          {href ? (
            <Link href={href} className="mt-0.5 shrink-0" aria-label={`${collection.title} collection`}>
              <ClubMark
                image={collection.image}
                initials={clubInitials(collection.curator?.name, collection.title)}
                title={collection.title}
              />
            </Link>
          ) : (
            <ClubMark
              image={collection.image}
              initials={clubInitials(collection.curator?.name, collection.title)}
              title={collection.title}
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2
                id={`${collection._id}-title`}
                className="font-display text-[1.35rem] leading-none font-black tracking-[-0.03em] sm:text-[1.5rem]"
              >
                {href ? (
                  <Link href={href} className="hover:underline">
                    {collection.title}
                  </Link>
                ) : (
                  collection.title
                )}
              </h2>
              {curator ? <p className="text-sm text-muted">with {curator}</p> : null}
            </div>
            {count ? (
              <p className="mt-1.5 text-sm font-bold text-black/70">
                {count} {count === 1 ? 'selection' : 'selections'}
              </p>
            ) : null}
            {collection.description ? (
              <p className="mt-1 truncate text-sm text-muted">{collection.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-sm border bg-paper px-3 text-[0.62rem] font-medium tracking-[0.14em] uppercase border-[#d6d6d6]! hover:bg-white"
            >
              <span aria-hidden="true">+</span>
              Follow
            </a>
          ) : (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-sm border bg-paper px-3 text-[0.62rem] font-medium tracking-[0.14em] uppercase border-[#d6d6d6]! opacity-40">
              <span aria-hidden="true">+</span>
              Follow
            </span>
          )}
          <button
            type="button"
            className={control}
            aria-label={`Previous books in ${collection.title}`}
            onClick={() => scrollByPage(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={control}
            aria-label={`Next books in ${collection.title}`}
            onClick={() => scrollByPage(1)}
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="collection-rail mt-8 flex gap-8 overflow-x-auto pb-2"
        tabIndex={0}
        aria-label={`${collection.title} books`}
      >
        {entries.map((entry) => {
          const book = entry.book!
          return (
            <Link
              key={`${collection._id}-${entry.selectionNumber}-${book._id}`}
              href={bookHref(book, collection.slug)}
              className="group w-44 shrink-0 sm:w-42"
            >
              <BookCover
                cover={catalogCover(book)}
                title={book.title}
                imageWidth={480}
                className="aspect-2/3 w-full rounded-none"
                sizes="(max-width: 640px) 11rem, 12rem"
              />
              <p className="mt-3 line-clamp-2 text-[0.95rem] font-medium leading-snug tracking-[-0.01em]">
                {book.title}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted">
                {book.authors?.filter(Boolean).join(', ') || 'Author unknown'}
              </p>
            </Link>
          )
        })}
        {href ? (
          <Link
            href={href}
            className="flex h-66 w-36 shrink-0 flex-col justify-center gap-3 self-start border border-dashed px-5 text-center border-[#d6d6d6]! sm:h-[18rem] sm:w-40"
          >
            <span className="text-[0.68rem] font-medium leading-snug tracking-[0.12em] uppercase">
              More from
              <br />
              {collection.title}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </section>
  )
}
