'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'

export type DirectoryGenre = {
  _id: string
  title: string
  slug: string
  description?: string | null
  bookCount?: number | null
  parent?: {title?: string | null; slug?: string | null} | null
}

export function GenresDirectory({genres}: {genres: DirectoryGenre[]}) {
  const [query, setQuery] = useState('')
  const filteredGenres = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    if (!search) return genres

    return genres.filter((genre) =>
      [genre.title, genre.description, genre.parent?.title]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(search)),
    )
  }, [genres, query])

  return (
    <section className="mt-10">
      <div className="flex flex-col gap-4 border-b border-(--line) pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-xl">
          <label
            htmlFor="genre-search"
            className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase"
          >
            Find a genre
          </label>
          <div className="mt-3 flex h-12 items-center rounded-sm border border-ink bg-paper px-4">
            <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-muted" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <input
              id="genre-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search genres…"
              autoComplete="off"
              className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-muted"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="font-mono text-[10px] font-medium tracking-[0.12em] text-muted uppercase hover:text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <p className="shrink-0 font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
          {filteredGenres.length} {filteredGenres.length === 1 ? 'genre' : 'genres'}
        </p>
      </div>

      {filteredGenres.length ? (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 lg:grid-cols-3">
          {filteredGenres.map((genre) => (
            <Link
              key={genre._id}
              href={`/browse/${genre.slug}`}
              className="group flex min-h-44 min-w-0 flex-col border-t border-(--line) pt-5 sm:min-h-48"
            >
              <p className="truncate font-mono text-[9px] font-medium tracking-[0.14em] text-muted uppercase sm:text-[10px] sm:tracking-[0.16em]">
                {genre.parent?.title || 'Genre'}
              </p>
              <h2 className="mt-3 font-display text-[1.35rem] leading-none font-black tracking-tighter wrap-break-word sm:text-[1.8rem]">
                {genre.title}
                <span className="text-[#b8b8b8]" aria-hidden="true">.</span>
              </h2>
              {genre.description ? (
                <p className="mt-3 line-clamp-3 hidden text-sm leading-6 text-muted sm:block">
                  {genre.description}
                </p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-6 font-mono text-[9px] font-medium tracking-widest text-muted uppercase sm:gap-4 sm:text-[10px] sm:tracking-[0.14em]">
                <span>
                  {genre.bookCount || 0} {genre.bookCount === 1 ? 'book' : 'books'}
                </span>
                <span className="text-ink transition-transform group-hover:translate-x-1" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-b border-(--line) py-14 text-center">
          <p className="font-display text-2xl font-black tracking-tight">No genres found.</p>
          <p className="mt-2 text-sm text-muted">Try a different title or broader phrase.</p>
        </div>
      )}
    </section>
  )
}
