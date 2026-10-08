import {notFound} from 'next/navigation'
import Link from 'next/link'
import {fetchCatalog} from '@/sanity/fetch'
import {bookCardFields} from '@/sanity/queries'
import {BackButton} from '@/components/BackButton'
import {BookCard, type BookCardData} from '@/components/BookCard'
import {EmptyState} from '@/components/States'

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{genre: string}>
  searchParams: Promise<{page?: string}>
}) {
  const {genre} = await params
  const {page: pageParam} = await searchParams
  const page = Math.max(1, Number(pageParam || '1') || 1)
  const start = (page - 1) * 16
  const end = start + 16

  const genreDoc = await fetchCatalog<{
    title: string
    slug?: string
    description?: string
    parent?: {title?: string; slug?: string}
  } | null>(
    `*[_type == "genre" && slug.current == $genre][0]{title, "slug": slug.current, description, "parent": parent->{title, "slug": slug.current}}`,
    {genre},
  )
  if (!genreDoc) notFound()

  const subgenres = await fetchCatalog<{title: string; slug?: string}[]>(
    `*[_type == "genre" && parent->slug.current == $genre] | order(title asc){title, "slug": slug.current}`,
    {genre},
  )
  const books = await fetchCatalog<BookCardData[]>(
    `*[_type == "book" && defined(slug.current) && $genre in genres[]->slug.current] | order(title asc) [${start}...${end}]{ ${bookCardFields} }`,
    {genre},
  )
  const total = await fetchCatalog<number>(
    `count(*[_type == "book" && defined(slug.current) && $genre in genres[]->slug.current])`,
    {genre},
  )

  return (
    <div className="px-5 pb-20 sm:px-8 lg:px-9">
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <BackButton />
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.16em] uppercase"
        >
          Discover
          <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
            <path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6 4h6v6" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </Link>
      </div>

      <header className="border-b border-(--line) pt-8 pb-10">
        <p className="font-mono text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
          {genreDoc.parent?.slug ? (
            <Link href={`/browse/${genreDoc.parent.slug}`} className="hover:text-ink hover:underline">
              {genreDoc.parent.title}
            </Link>
          ) : 'Browse the archive'}
        </p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-[clamp(3.6rem,9vw,7rem)] leading-[0.82] font-black tracking-[-0.08em]">
              {genreDoc.title}
              <span className="text-[#b8b8b8]" aria-hidden="true">.</span>
            </h1>
            {genreDoc.description ? (
              <p className="mt-6 max-w-2xl text-[1.05rem] leading-7 text-muted">
                {genreDoc.description}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="font-display text-[2rem] leading-none font-black tracking-[-0.06em]">
              {String(total).padStart(2, '0')}
            </p>
            <p className="mt-2 font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
              {total === 1 ? 'Book' : 'Books'}
            </p>
          </div>
        </div>
      </header>

      {subgenres.length ? (
        <nav className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3" aria-label={`${genreDoc.title} subgenres`}>
          <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
            Explore
          </span>
          {subgenres.map((item) => (
            <Link
              key={item.slug}
              href={`/browse/${item.slug}`}
              className="font-mono text-[11px] font-medium tracking-[0.12em] uppercase underline-offset-4 hover:underline"
            >
              {item.title}
            </Link>
          ))}
        </nav>
      ) : null}
      {genre === 'fantasy' ? (
        <p className="mt-6">
          <Link
            href="/browse/fantasy/2024"
            className="inline-flex border border-ink px-4 py-2.5 font-mono text-[10px] font-medium tracking-[0.14em] uppercase hover:bg-ink hover:text-white"
          >
            Highly rated fantasy by year
          </Link>
        </p>
      ) : null}
      {books.length ? (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4 border-b border-(--line) pb-3">
            <h2 className="font-display text-[1.45rem] leading-none font-black tracking-[-0.04em]">
              Books
            </h2>
            <p className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
              Page {page}
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:gap-x-6">
            {books.map((book) => (
              <BookCard key={book._id} book={book} fill coverClassName="max-h-[300px] max-w-[min(100%,200px)]" />
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-10">
          <EmptyState title="No books in this genre yet" body="This is a full genre page. When more verified books are imported, they will appear here." />
        </div>
      )}
      <nav className="mt-12 flex items-center justify-between gap-3 border-t border-(--line) pt-6" aria-label="Genre pages">
        {page > 1 ? (
          <Link
            href={`/browse/${genre}?page=${page - 1}`}
            className="inline-flex items-center gap-2 border border-(--line) px-4 py-2.5 font-mono text-[10px] font-medium tracking-[0.14em] uppercase hover:border-ink"
          >
            <span aria-hidden="true">←</span>
            Previous page
          </Link>
        ) : <span />}
        {start + books.length < total ? (
          <Link
            href={`/browse/${genre}?page=${page + 1}`}
            className="inline-flex items-center gap-2 border border-(--line) px-4 py-2.5 font-mono text-[10px] font-medium tracking-[0.14em] uppercase hover:border-ink"
          >
            Next page
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </nav>
    </div>
  )
}
