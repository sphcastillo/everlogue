import Link from 'next/link'
import {notFound} from 'next/navigation'
import {fetchCatalog} from '@/sanity/fetch'
import {BOOK_BY_SLUG_QUERY} from '@/sanity/queries'
import {BookCover} from '@/components/BookCover'
import {StarRating} from '@/components/StarRating'
import {ShelfButtons} from '@/components/ShelfButtons'
import {LibraryCsvLog} from '@/components/LibraryCsvLog'
import {getOptionalReader} from '@/lib/reader'
import {getReaderBookState} from '@/lib/actions'
import {firstSentence} from '@/lib/club-title'

type BookClubRef = {
  title: string
  slug?: string | null
  curator?: {name?: string | null} | null
  description?: string | null
  selectionNumber?: number | null
}

export const dynamic = 'force-dynamic'

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{slug: string}>
  searchParams: Promise<{club?: string}>
}) {
  const {slug} = await params
  const {club: clubSlug} = await searchParams
  const book = await fetchCatalog<{
    _id: string
    title: string
    description?: string
    authors?: string[]
    cover?: Parameters<typeof BookCover>[0]['cover']
    clubs?: BookClubRef[]
  } | null>(BOOK_BY_SLUG_QUERY, {slug})

  if (!book) notFound()

  const reader = await getOptionalReader().catch(() => null)
  const state = await getReaderBookState(book._id)
  const club = (book.clubs || []).find((item) => item.slug && item.slug === clubSlug) || null
  const selectionNumber = club?.selectionNumber ?? null
  const authors = book.authors?.filter(Boolean).join(', ') || 'Author unknown'
  const quote = firstSentence(book.description)
  const backHref = club?.slug ? `/collections/${club.slug}` : '/my-books'
  const backLabel = club ? `Back to ${club.title}` : 'Back to my books'
  const clubTagline = firstSentence(club?.description)

  return (
    <article>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-9">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.16em] uppercase"
        >
          <span aria-hidden="true">←</span>
          {backLabel}
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
        <section className="relative flex min-h-120 flex-col bg-(--palette-cloud) px-8 py-8 sm:px-10">
          {club ? (
            <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
              Club selection{selectionNumber ? ` / ${String(selectionNumber).padStart(2, '0')}` : ''}
            </p>
          ) : (
            <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">From the catalog</p>
          )}
          <div className="flex flex-1 items-center justify-center py-10">
            <BookCover
              cover={book.cover}
              title={book.title}
              priority
              imageWidth={1200}
              className="aspect-2/3 w-full max-w-72 shadow-[0_24px_50px_rgba(17,17,17,0.18)]"
              sizes="(max-width: 1024px) 70vw, 22rem"
            />
          </div>
          {club ? (
            <p className="self-end text-right font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
              From the shelf of
              <span className="mt-1 block font-sans text-[0.82rem] tracking-normal text-ink normal-case">
                {club.title}
              </span>
            </p>
          ) : null}
        </section>

        <section className="flex flex-col px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
          {club ? (
            <div>
              <p className="flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">
                <span className="inline-block w-8 border-t border-ink" aria-hidden="true" />
                Selected by {club.curator?.name || club.title}
              </p>
              <p className="mt-4 font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">{club.title}</p>
            </div>
          ) : (
            <p className="flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">
              <span className="inline-block w-8 border-t border-ink" aria-hidden="true" />
              In the catalog
            </p>
          )}

          <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.88] font-black tracking-[-0.08em]">
            {book.title}
            <span aria-hidden="true">.</span>
          </h1>
          <p className="mt-4 text-[1.05rem] text-ink">
            by <span className="font-medium">{authors}</span>
          </p>

          {quote ? (
            <blockquote className="mt-8 max-w-xl border-l-2 border-ink pl-5 font-accent text-[clamp(1.25rem,2.4vw,1.85rem)] leading-[1.25] text-ink italic">
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
              <ShelfButtons bookId={book._id} status={state.status} signedIn={Boolean(reader)} />
            </div>
            <div className="mt-8">
              <StarRating bookId={book._id} value={state.rating} signedIn={Boolean(reader)} />
            </div>
            {!reader ? (
              <p className="mt-3 text-sm text-muted">Sign in to keep this book on a shelf.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-(--line) px-5 py-6 sm:px-8 lg:px-9">
        <p className="flex items-start gap-3 text-sm leading-6 text-muted">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center border text-xs border-[#d6d6d6]!" aria-hidden="true">
            ✳
          </span>
          {club
            ? 'A good club pick is a beginning, not a verdict. Put it on a shelf and make the reading yours.'
            : 'This is your copy of the book. Put it on a shelf and make the reading yours.'}
        </p>
        {clubTagline ? (
          <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted uppercase">{clubTagline}</p>
        ) : null}
      </div>

      <p className="flex flex-wrap items-center justify-between gap-3 border-t border-(--line) px-5 py-4 font-mono text-[11px] font-medium tracking-[0.16em] text-muted uppercase sm:px-8 lg:px-9">
        <span>Read widely. Think freely.</span>
        <span>Everlogue — a reader&apos;s place</span>
      </p>

      <LibraryCsvLog data={state.csv} />
    </article>
  )
}
