'use client'

import {useMemo, useState} from 'react'
import {CollectionCarousel, type CarouselCollection} from './CollectionCarousel'
import {EmptyState} from './States'

export default function DiscoverHero({
  collections,
  hasShelves,
}: {
  collections: CarouselCollection[]
  hasShelves: boolean
}) {
  const [query, setQuery] = useState('')
  const clubs = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return collections
    return collections.filter((collection) => {
      const haystack = [
        collection.title,
        collection.curator?.name,
        collection.description,
        collection.collectionType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [collections, query])

  return (
    <div>
      <section className="px-5 pt-6 pb-10 sm:px-8 lg:px-9 lg:pt-8 lg:pb-14">
        <p className="flex h-7 items-center gap-3 font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">
          <span className="inline-block w-8 border-t border-ink" aria-hidden="true" />
          The Best Place to Start
        </p>

        <div className="mt-8 grid items-stretch gap-10 lg:grid-cols-[minmax(0,1.1fr)_auto_minmax(22rem,30rem)] lg:gap-x-6 xl:gap-x-10">
          <div>
            <h1 className="max-w-4xl font-display text-[clamp(5rem,calc(4.3rem+2.7vw),6.4rem)] leading-[0.86] font-black tracking-[-0.13em]">
              <span className="block">Read with</span>
              <span className="block">
                a point of view<span className="text-[#b8b8b8]" aria-hidden="true">.</span>
              </span>
            </h1>
            <p className="mt-7 max-w-96 text-[1.02rem] leading-[1.6] text-muted">
              The book clubs making the group chat better. Browse their pick lists, follow the hosts whose taste
              you trust, and find your next read.
            </p>
          </div>

          <a
            href="#reading-list"
            className="inline-flex items-center gap-2.5 self-center border-b border-ink pb-0.5 font-mono text-[0.68rem] font-medium tracking-[0.16em] text-ink uppercase border-b-ink!"
          >
            Find your club
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
              <path d="M8 3v9" stroke="currentColor" strokeWidth="1.4" />
              <path d="M4.5 8.5 8 12l3.5-3.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </a>

          <div className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-ink px-8 py-8 text-white xl:min-h-80">
            <span
              className="pointer-events-none absolute -top-18 -right-14 size-56 rounded-full border border-white/15"
              aria-hidden="true"
            />
            <div className="relative z-1 flex items-start justify-between gap-6">
              <p className="max-w-40 font-mono text-[0.62rem] leading-4 font-medium tracking-[0.16em] uppercase">
                A good recommendation changes the room.
              </p>
              <span className="grid size-7 place-items-center text-white/80" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                  <path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M6 4h6v6" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
            </div>
            <p className="relative z-1 font-accent text-[clamp(2rem,3.2vw,2.85rem)] leading-[1.05] text-white italic">
              &ldquo;What are you reading?&rdquo;
            </p>
            <div className="relative z-1 border-t border-white/20 pt-5">
              <div className="flex items-end justify-between gap-4 font-mono text-[0.62rem] font-medium tracking-[0.16em] uppercase">
                <p>The best place to start</p>
                <p className="text-white/70">Chapter / 01</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="reading-list" className="scroll-mt-24 border-t border-(--line) px-5 pt-10 pb-6 sm:px-8 lg:px-9">
        <p className="font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">The Book Club Spotlight</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-[clamp(2.1rem,5vw,3.6rem)] leading-[0.95] font-black tracking-[-0.08em]">
            Clubs worth following
          </h2>

        </div>
      </section>

      <div className="space-y-16 px-5 pb-12 sm:px-8 lg:px-9">
        {clubs.map((collection) => (
          <CollectionCarousel key={collection._id} collection={collection} />
        ))}
        {query && clubs.length === 0 ? (
          <EmptyState
            title="No clubs match that search"
            body="Try a club name, host, or a shorter phrase."
          />
        ) : null}
        {!hasShelves ? (
          <EmptyState
            title="The shelves are still being set"
            body="No editorial collections are published yet. Search books to find your next read."
          />
        ) : null}
      </div>
    </div>
  )
}
