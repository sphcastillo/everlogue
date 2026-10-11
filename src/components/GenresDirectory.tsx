'use client'

import Link from 'next/link'
import {useMemo, useState, type ReactNode} from 'react'

export type DirectoryGenre = {
  _id: string
  title: string
  slug: string
  description?: string | null
  bookCount?: number | null
  parent?: {title?: string | null; slug?: string | null} | null
}

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

type Family = {
  key: string
  title: string
  slug?: string | null
  head?: DirectoryGenre | null
  children: DirectoryGenre[]
}

function letterFor(title: string) {
  const letter = title
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .charAt(0)
    .toUpperCase()
  return /[A-Z]/.test(letter) ? letter : '#'
}

function groupByLetter<T extends {title: string}>(items: T[]) {
  const grouped = new Map<string, T[]>()
  for (const item of items) {
    const letter = letterFor(item.title)
    grouped.set(letter, [...(grouped.get(letter) || []), item])
  }
  return LETTERS.filter((letter) => grouped.has(letter)).map((letter) => ({
    letter,
    items: grouped.get(letter) || [],
  }))
}

function buildFamilies(genres: DirectoryGenre[]): Family[] {
  const families = new Map<string, Family>()

  function family(key: string, title: string, slug?: string | null, head?: DirectoryGenre | null) {
    const current = families.get(key) || {key, title, slug: slug || null, head: null, children: []}
    if (head) current.head = head
    current.title = current.head?.title || current.title || title
    current.slug = current.head?.slug || current.slug || slug || null
    families.set(key, current)
    return current
  }

  for (const genre of genres) {
    if (!genre.parent?.slug) family(genre.slug || genre._id, genre.title, genre.slug, genre)
  }
  for (const genre of genres) {
    if (!genre.parent?.slug) continue
    family(genre.parent.slug, genre.parent.title || genre.parent.slug, genre.parent.slug).children.push(genre)
  }

  return [...families.values()]
    .map((group) => ({
      ...group,
      children: [...group.children].sort((left, right) => left.title.localeCompare(right.title)),
    }))
    .sort((left, right) => left.title.localeCompare(right.title))
}

function LetterSection({letter, children}: {letter: string; children: ReactNode}) {
  return (
    <section
      id={`genre-${letter === '#' ? 'other' : letter}`}
      className="scroll-mt-52 border-t border-(--line) py-6 lg:scroll-mt-44"
    >
      <h2 className="font-display text-3xl leading-none font-black tracking-[-0.06em] text-muted">
        {letter}
      </h2>
      <div className="mt-3 columns-1 sm:columns-2 lg:columns-3 sm:gap-x-8">
        {children}
      </div>
    </section>
  )
}

function GenreRow({genre, nested = false}: {genre: DirectoryGenre; nested?: boolean}) {
  return (
    <Link
      href={`/browse/${genre.slug}`}
      className={`group flex items-baseline justify-between gap-3 border-(--line) py-2.5 hover:text-ink ${nested ? 'border-l pl-3 text-sm' : 'border-t pt-3'}`}
    >
      <span className="min-w-0">
        <span className={nested ? 'font-medium' : 'font-display text-[1.15rem] leading-none font-black tracking-tight'}>
          {genre.title}
        </span>
        {genre.parent?.title && nested ? (
          <span className="sr-only"> in {genre.parent.title}</span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
        {genre.bookCount || 0}
      </span>
    </Link>
  )
}

export function GenresDirectory({genres}: {genres: DirectoryGenre[]}) {
  const [query, setQuery] = useState('')
  const search = query.trim().toLocaleLowerCase()
  const filteredGenres = useMemo(() => {
    if (!search) return genres
    return genres.filter((genre) =>
      [genre.title, genre.description, genre.parent?.title]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(search)),
    )
  }, [genres, search])

  const families = useMemo(() => buildFamilies(filteredGenres), [filteredGenres])
  const searchSections = useMemo(() => (search ? groupByLetter(filteredGenres) : []), [filteredGenres, search])
  const familySections = useMemo(() => (search ? [] : groupByLetter(families)), [families, search])
  const sections = search ? searchSections : familySections
  const activeLetters = new Set(sections.map((section) => section.letter))

  return (
    <section className="mt-10">
      <div className="sticky top-28 z-20 border-b border-(--line) bg-paper py-4 lg:top-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
                placeholder="Mystery, memoir, romantasy…"
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
        <nav className="mt-4 flex flex-wrap gap-x-1.5 gap-y-1" aria-label="Jump to a letter">
          {LETTERS.filter((letter) => letter !== '#' || activeLetters.has('#')).map((letter) =>
            activeLetters.has(letter) ? (
              <a
                key={letter}
                href={`#genre-${letter === '#' ? 'other' : letter}`}
                className="min-w-6 px-0.5 text-center font-mono text-[11px] font-medium text-ink underline-offset-4 hover:underline"
              >
                {letter}
              </a>
            ) : (
              <span key={letter} className="min-w-6 px-0.5 text-center font-mono text-[11px] text-muted/45">
                {letter}
              </span>
            ),
          )}
        </nav>
      </div>

      {sections.length ? (
        <div className="mt-2">
          {search
            ? searchSections.map((section) => (
                <LetterSection key={section.letter} letter={section.letter}>
                  {section.items.map((genre) => (
                    <div key={genre._id} className="break-inside-avoid">
                      <GenreRow genre={genre} />
                    </div>
                  ))}
                </LetterSection>
              ))
            : familySections.map((section) => (
                <LetterSection key={section.letter} letter={section.letter}>
                  {section.items.map((family) => (
                    <div key={family.key} className="break-inside-avoid pb-4">
                      {family.head ? <GenreRow genre={family.head} /> : (
                        <p className="border-t border-(--line) pt-3 font-display text-[1.15rem] leading-none font-black tracking-tight">
                          {family.title}
                        </p>
                      )}
                      {family.children.length ? (
                        <div className="mt-1">
                          {family.children.map((genre) => (
                            <GenreRow key={genre._id} genre={genre} nested />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </LetterSection>
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
