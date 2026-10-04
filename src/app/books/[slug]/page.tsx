import Link from 'next/link'
import {notFound} from 'next/navigation'
import {fetchCatalog} from '@/sanity/fetch'
import {BOOK_BY_SLUG_QUERY} from '@/sanity/queries'
import {BackButton} from '@/components/BackButton'
import {BookCover} from '@/components/BookCover'
import {BookLibraryActions} from '@/components/BookLibraryActions'
import {LibraryCsvLog} from '@/components/LibraryCsvLog'
import {getOptionalReader} from '@/lib/reader'
import {getReaderBookState} from '@/lib/actions'

type BookClubRef = {
  title: string
  slug?: string | null
  href?: string | null
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
    genres?: Array<{_id?: string; title?: string | null; slug?: string | null}>
    cover?: Parameters<typeof BookCover>[0]['cover']
    clubs?: BookClubRef[]
    celebrityClubs?: BookClubRef[]
  } | null>(BOOK_BY_SLUG_QUERY, {slug})

  if (!book) notFound()

  const reader = await getOptionalReader().catch(() => null)
  const state = await getReaderBookState(book._id)
  const bookClubs = [...(book.clubs || []), ...(book.celebrityClubs || [])]
  const club = bookClubs.find((item) => item.slug && item.slug === clubSlug) || null
  const displayClub = club || bookClubs[0] || null
  const authors = book.authors?.filter(Boolean).join(', ') || 'Author unknown'
  const genres = book.genres?.filter(genre => genre.title) || []

  return (
    <article>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-9">
        <BackButton />
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.16em] uppercase"
        >
          My profile
          <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
            <path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6 4h6v6" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </Link>
      </div>

      <div className="grid items-start lg:grid-cols-[minmax(18rem,32rem)_minmax(0,1fr)]">
        <section className="relative flex min-h-120 flex-col bg-(--palette-cloud) px-8 py-8 sm:px-10">
            <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
              From the archive
            </p>
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
          {displayClub ? (
            <p className="self-end text-right font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
              From the shelf of
              <span className="mt-1 block font-sans text-[0.82rem] tracking-normal text-ink normal-case">
                {displayClub.title}
              </span>
            </p>
          ) : null}
        </section>

        <section className="flex flex-col px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
          <p className="flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">
            <span className="inline-block w-8 border-t border-ink" aria-hidden="true" />
            About the book
          </p>

          <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.88] font-black tracking-[-0.08em]">
            {book.title}
            <span className="text-[#b8b8b8]" aria-hidden="true">.</span>
          </h1>
          <p className="mt-4 text-[1.05rem]">
            <span className="text-muted">by</span>{' '}
            <span className="font-semibold text-ink">{authors}</span>
          </p>

          {book.description ? (
            <p className="mt-8 max-w-2xl whitespace-pre-line border-l-2 border-ink pl-5 font-accent text-[clamp(1.05rem,1.8vw,1.4rem)] leading-snug text-ink italic">
              {book.description}
            </p>
          ) : null}

          {genres.length ? (
            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted pt-3">
                {genres.map((genre, index) => (
                  <span key={genre._id || genre.slug || genre.title} className="whitespace-nowrap">
                    {genre.slug ? (
                      <Link href={`/browse/${genre.slug}`} className="hover:text-ink hover:underline">
                        {genre.title}
                      </Link>
                    ) : genre.title}
                    {index < genres.length - 1 ? <span aria-hidden="true"> ·</span> : null}
                  </span>
                ))}
              </span>
            </div>
          ) : null}

          <div className="mt-auto pt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Your reading shelf</p>
                <p className="mt-1 text-[1.02rem] font-medium">Where should this one live?</p>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                  <path d="M2.5 3.5h3A2.5 2.5 0 0 1 8 6v7.5a2.5 2.5 0 0 0-2.5-2.5h-3V3.5Z" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M13.5 3.5h-3A2.5 2.5 0 0 0 8 6v7.5a2.5 2.5 0 0 1 2.5-2.5h3V3.5Z" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                One shelf at a time
              </p>
            </div>
            <div className="mt-5">
              <BookLibraryActions
                bookId={book._id}
                signedIn={Boolean(reader)}
                status={state.status}
                rating={state.rating}
                review={state.review}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex min-h-32 items-center border-t border-(--line) px-5 py-9 sm:px-8 lg:px-9">
        <p className="flex items-center gap-5 text-[1rem] leading-6 text-muted">
          <span className="grid size-14 shrink-0 place-items-center border border-[#d6d6d6]!" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-6" fill="none">
              <path d="M12 4.5c0 4.7-2.1 7-6.5 7 4.4 0 6.5 2.3 6.5 7 0-4.7 2.1-7 6.5-7-4.4 0-6.5-2.3-6.5-7Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
              <path d="M18.5 3v3M20 4.5h-3M5 16.5v2M6 17.5H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
          {displayClub
            ? 'A good club pick is a beginning, not a verdict. Put it on a shelf and make the reading yours.'
            : 'This is your copy of the book. Put it on a shelf and make the reading yours.'}
        </p>
      </div>

      <LibraryCsvLog data={state.csv} />
    </article>
  )
}
