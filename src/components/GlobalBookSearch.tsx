'use client'

import Link from 'next/link'
import {useEffect, useId, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {BookCover} from './BookCover'
import {bookTitle, coverSrc, type GoogleBook, type GoogleSearchResponse} from '@/lib/google-books'

export function GlobalBookSearch({variant = 'default'}: {variant?: 'default' | 'header' | 'catalog'}) {
  const generatedId = useId()
  const header = variant === 'header'
  const catalog = variant === 'catalog'
  const inputId = header ? 'header-book-search' : generatedId
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [menuBox, setMenuBox] = useState<{top: number; left: number; width: number} | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [error, setError] = useState('')
  const [books, setBooks] = useState<GoogleBook[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    function place() {
      const box = rootRef.current?.getBoundingClientRect()
      if (box) setMenuBox({top: box.bottom + 10, left: box.left, width: box.width})
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function onFocusIn(event: FocusEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        place()
        setOpen(true)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
      if (header && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        place()
        setOpen(true)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [inputId, header])

  useEffect(() => {
    if (!open) {
      setMenuBox(null)
      return
    }
    function update() {
      const box = rootRef.current?.getBoundingClientRect()
      if (!box) return
      setMenuBox({top: box.bottom + 10, left: box.left, width: box.width})
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  async function searchBooks(value: string) {
    const q = value.trim()
    if (q.length < 2) {
      setError('Enter at least 2 characters to search.')
      setStatus('error')
      setOpen(true)
      return
    }

    setStatus('loading')
    setError('')
    setOpen(true)

    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`)
      const data = (await response.json().catch(() => null)) as GoogleSearchResponse | null
      if (!response.ok || !data) {
        throw new Error(data?.error || 'Search couldn’t be completed.')
      }
      setBooks(data.items || [])
      setTotal(data.totalItems ?? data.items?.length ?? 0)
      setStatus('done')
    } catch (caught) {
      setBooks([])
      setTotal(0)
      setError(caught instanceof Error ? caught.message : 'Search couldn’t be completed.')
      setStatus('error')
    }
  }

  function openMenu() {
    const box = rootRef.current?.getBoundingClientRect()
    if (box) setMenuBox({top: box.bottom + 10, left: box.left, width: box.width})
    setOpen(true)
  }

  const queryText = query.trim()
  const showHint = status === 'idle' || (!queryText && status !== 'error' && status !== 'loading')

  return (
    <div
      ref={rootRef}
      className={
        header ? 'relative w-full min-w-0' : catalog ? 'relative w-full min-w-0' : 'relative mx-auto max-w-2xl'
      }
    >
      <form
        role="search"
        className={
          header
            ? 'flex h-11 items-center gap-2.5 rounded-md border bg-paper px-4 border-[#d6d6d6]!'
            : catalog
              ? 'flex h-12 items-center border border-ink bg-white'
              : 'flex items-center gap-2'
        }
        onSubmit={(event) => {
          event.preventDefault()
          void searchBooks(query)
        }}
        onClick={() => {
          inputRef.current?.focus()
          openMenu()
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Search books
        </label>
        {(header || catalog) ? (
          <svg viewBox="0 0 16 16" className={`size-4 shrink-0 text-muted ${catalog ? 'ml-3' : ''}`} fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
            <path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => openMenu()}
          minLength={2}
          maxLength={200}
          placeholder={
            catalog ? 'A title, an author…' : header ? 'Books, people, ideas' : 'Search books by title, author, or ISBN'
          }
          autoComplete="off"
          className={
            header
              ? 'min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-muted'
              : catalog
                ? 'min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-muted'
                : 'min-w-0 flex-1 rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 outline-none focus:border-accent'
          }
        />
        {header ? (
          <kbd className="hidden shrink-0 font-sans text-sm font-normal text-muted lg:inline">⌘K</kbd>
        ) : (
          <button
            type="submit"
            className={
              catalog
                ? 'inline-flex h-full shrink-0 items-center gap-2 bg-ink px-4 font-mono text-[0.68rem] font-medium tracking-[0.16em] text-white uppercase disabled:opacity-60'
                : 'shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm text-paper disabled:opacity-60'
            }
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Searching…' : 'Search'}
            {catalog ? (
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <path d="M3 8h9" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 4l5 4-5 4" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            ) : null}
          </button>
        )}
      </form>
      {open && menuBox && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="max-h-112 overflow-auto rounded-md bg-paper p-3 shadow-lg"
              style={{position: 'fixed', top: menuBox.top, left: menuBox.left, width: menuBox.width, zIndex: 80}}
              role="region"
              aria-live="polite"
              aria-label={showHint ? 'Search hint' : 'Book search results'}
            >
          {showHint ? (
            <div className="px-3 py-4">
              <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
                Find your next book
              </p>
              <p className="mt-2 text-sm text-muted">
                Search by title or author, then choose a book to see its page.
              </p>
            </div>
          ) : null}
          {queryText && status === 'loading' ? <p className="px-3 py-4 text-sm text-muted">Searching for books…</p> : null}
          {status === 'error' ? (
            <div className="px-3 py-4">
              <p role="alert" className="text-sm">
                {error}
              </p>
              <button
                type="button"
                className="mt-3 rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-sm hover:bg-white"
                onClick={() => void searchBooks(query)}
              >
                Try again
              </button>
            </div>
          ) : null}
          {queryText && status === 'done' && !books.length ? (
            <p className="px-3 py-4 text-sm text-muted">No books found. Try a different title, author, or ISBN.</p>
          ) : null}
          {queryText && status === 'done' && books.length ? (
            <>
              <p className="px-3 pb-2 text-xs text-muted">
                {total.toLocaleString('en-US')} {total === 1 ? 'book' : 'books'} matching “{query.trim()}”
              </p>
              <ul className="grid gap-1">
                {books.map((book) => {
                  const title = bookTitle(book)
                  const authors = book.volumeInfo?.authors?.join(', ')
                  const year = book.volumeInfo?.publishedDate?.slice(0, 4)
                  const cover = coverSrc(book)
                  return (
                    <li key={book.id}>
                      <Link
                        href={`/search/${book.id}`}
                        className="flex gap-3 rounded-2xl px-3 py-2 hover:bg-ink/5"
                        onClick={() => {
                          console.log('[search] Selected book', book)
                          setOpen(false)
                        }}
                      >
                        <BookCover
                          cover={{
                            coverUrl: cover,
                            isbn13: book.volumeInfo?.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier,
                            isbn10: book.volumeInfo?.industryIdentifiers?.find((id) => id.type === 'ISBN_10')?.identifier,
                          }}
                          title={title}
                          className="h-16 w-11 shrink-0"
                          sizes="44px"
                          imageWidth={132}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium leading-snug">{title}</p>
                          <p className="mt-0.5 truncate text-sm text-muted">{authors || 'Author unknown'}</p>
                          {year ? <p className="mt-0.5 text-xs text-muted">{year}</p> : null}
                          <p className="mt-1 text-xs text-accent">View book</p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
