import Link from 'next/link'
import {
  bookTitle,
  coverSrc,
  plainText,
  type GoogleBook,
} from '@/lib/google-books'
import {firstSentence} from '@/lib/club-title'
import {BookCover, type CoverSource} from './BookCover'
import {LogSelectedBook} from './LogSelectedBook'
import {ShelfButtons} from './ShelfButtons'

type SearchClub = {
  title: string
  slug?: string | null
  curator?: {name?: string | null} | null
  description?: string | null
  selectionNumber?: number | null
}

export type SearchCatalogBook = {
  _id: string
  title: string
  description?: string | null
  authors?: string[] | null
  cover?: CoverSource | null
  clubs?: SearchClub[] | null
}

export function SearchBookDetail({
  book,
  catalog,
  signedIn,
  status,
}: {
  book: GoogleBook
  catalog?: SearchCatalogBook | null
  signedIn: boolean
  status: string | null
}) {
  const info = book.volumeInfo
  const identifiers = info?.industryIdentifiers || []
  const title = catalog?.title || bookTitle(book)
  const authors = catalog?.authors?.filter(Boolean).join(', ') || info?.authors?.join(', ') || 'Author unknown'
  const quote = firstSentence(catalog?.description || plainText(info?.description) || plainText(book.searchInfo?.textSnippet))
  const club = catalog?.clubs?.find((item) => item.title) || null
  const cover: CoverSource | null = catalog?.cover || {
    coverUrl: coverSrc(book),
    isbn13: identifiers.find((id) => id.type === 'ISBN_13')?.identifier,
    isbn10: identifiers.find((id) => id.type === 'ISBN_10')?.identifier,
  }

  return (
    <article>
      <LogSelectedBook book={book} source="landing page" />
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-9">
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.16em] uppercase"
        >
          <span aria-hidden="true">←</span>
          Back to Discover
        </Link>
        <Link
          href="/my-books"
          className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.16em] uppercase"
        >
          My books
          <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
            <path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6 4h6v6" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </Link>
      </div>

      <div className="grid lg:grid-cols-[minmax(18rem,32rem)_minmax(0,1fr)]">
        <section className="relative flex min-h-120 flex-col overflow-hidden bg-(--palette-cloud) px-8 py-8 sm:px-10">
          <span
            className="pointer-events-none absolute -right-24 -bottom-28 size-112 rounded-full border border-white/45"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -right-8 -bottom-8 size-72 rounded-full border border-white/35"
            aria-hidden="true"
          />
          <p className="relative z-1 flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.4 10.4 13 13" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            From your search
          </p>
          <div className="relative z-1 flex flex-1 items-center justify-center py-10">
            <BookCover
              cover={cover}
              title={title}
              priority
              imageWidth={1200}
              className="aspect-2/3 w-full max-w-80 shadow-[0_28px_60px_rgba(17,17,17,0.22)]"
              sizes="(max-width: 1024px) 72vw, 26rem"
            />
          </div>
          <p className="relative z-1 self-end text-right font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
            A title worth pausing for
            <span className="mt-1 block font-sans text-[0.82rem] tracking-normal text-(--palette-clay) normal-case">
              Everlogue search
            </span>
          </p>
        </section>

        <section className="flex flex-col px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
          <p className="flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">
            <span className="inline-block w-8 border-t border-(--palette-clay)" aria-hidden="true" />
            A book found in good company
          </p>
          {club ? (
            <p className="mt-4 font-mono text-[11px] font-medium tracking-[0.18em] text-(--palette-clay) uppercase">
              Chosen by {club.title}
            </p>
          ) : null}

          <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.88] font-black tracking-[-0.08em]">
            {title}
            <span className="text-(--palette-clay)" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="mt-4 text-[1.05rem] text-ink">
            by <span className="font-medium">{authors}</span>
          </p>

          {quote ? (
            <blockquote className="mt-8 max-w-xl border-l-2 border-(--palette-clay) pl-5 font-accent text-[clamp(1.25rem,2.4vw,1.85rem)] leading-[1.25] text-ink italic">
              “{quote}”
            </blockquote>
          ) : null}

          <div className="mt-auto pt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Your reading shelf</p>
                <p className="mt-1 text-[1.02rem] font-medium">Where should this one live?</p>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                  <path d="M3 3.5h6.5A2.5 2.5 0 0 1 12 6v7H5.2A2.2 2.2 0 0 0 3 15.2V3.5Z" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                One shelf at a time
              </p>
            </div>
            <div className="mt-5">
              <ShelfButtons
                {...(catalog?._id ? {bookId: catalog._id} : {googleBooksId: book.id})}
                status={status}
                signedIn={signedIn}
              />
            </div>
            {!signedIn ? (
              <p className="mt-3 text-sm text-muted">Sign in to keep this book on a shelf.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-(--line) px-5 py-6 sm:px-8 lg:px-9">
        <p className="flex items-start gap-3 text-sm leading-6 text-muted">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center border text-xs border-[#d6d6d6]!" aria-hidden="true">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
              <path d="M3 3.5h6.5A2.5 2.5 0 0 1 12 6v7H5.2A2.2 2.2 0 0 0 3 15.2V3.5Z" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6.2 3.5V15" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </span>
          A search can turn into a reading life. Save your place here, then make the book your own.
        </p>
        <Link
          href="/my-books"
          className="font-mono text-[11px] font-medium tracking-[0.16em] text-(--palette-clay) uppercase"
        >
          Visit your shelves
          <span aria-hidden="true"> ↗</span>
        </Link>
      </div>
    </article>
  )
}
