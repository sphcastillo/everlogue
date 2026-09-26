import {notFound} from 'next/navigation'
import {fetchCatalog} from '@/sanity/fetch'
import {BOOK_BY_SLUG_QUERY} from '@/sanity/queries'
import {BookCover} from '@/components/BookCover'
import {StarRating} from '@/components/StarRating'
import {ShelfButtons} from '@/components/ShelfButtons'
import {LibraryCsvLog} from '@/components/LibraryCsvLog'
import {getOptionalReader} from '@/lib/reader'
import {getReaderBookState} from '@/lib/actions'

function formatLibraryDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})
}

export default async function BookPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params
  const book = await fetchCatalog<{
    _id: string
    title: string
    description?: string
    firstPublicationYear?: number
    firstPublicationDate?: string
    openLibraryWorkKey?: string
    authors?: string[]
    genres?: {title?: string; slug?: string}[]
    cover?: Parameters<typeof BookCover>[0]['cover']
    ratingStats?: {average?: number; count?: number}
    editions?: {
      _id: string
      title?: string
      isbn13?: string
      format?: string
      market?: string
      onSaleDate?: string
      isReprint?: boolean
      firstPublicationOfBook?: boolean
      publisher?: string
    }[]
  } | null>(BOOK_BY_SLUG_QUERY, {slug})

  if (!book) notFound()

  const reader = await getOptionalReader().catch(() => null)
  const state = await getReaderBookState(book._id)
  console.log('[Goodreads CSV]', state.csv)

  return (
    <article className="grid gap-10 lg:grid-cols-[240px_1fr]">
      <div className="group max-w-60">
        <BookCover cover={book.cover} title={book.title} priority className="aspect-2/3 w-full" />
      </div>
      <div>
        <p className="text-sm text-muted">
          {book.authors?.filter(Boolean).join(', ') || 'Author unknown'}
        </p>
        <h1 className="mt-1 font-(family-name:--font-display) text-[2.7rem] leading-[1.05] tracking-[-0.03em] sm:text-5xl">
          {book.title}
        </h1>
        <p className="mt-3 text-muted">
          First published {book.firstPublicationYear || 'year unknown'}
          {book.firstPublicationDate ? ` · dated ${book.firstPublicationDate}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {book.genres?.map((genre) => (
            <a key={genre.slug} href={`/browse/${genre.slug}`} className="pill px-3 py-1 text-sm">
              {genre.title}
            </a>
          ))}
        </div>
        <p className="mt-6 max-w-2xl leading-7">
          {book.description || 'No description is in this catalog yet. We do not invent one.'}
        </p>
        <div className="mt-6">
          <ShelfButtons bookId={book._id} status={state.status} signedIn={Boolean(reader)} />
        </div>
        <div className="mt-6 max-w-md">
          <StarRating bookId={book._id} value={state.rating} signedIn={Boolean(reader)} />
        </div>
        <LibraryCsvLog data={state.csv} />
        <dl className="mt-6 grid max-w-md grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Rating</dt>
            <dd className="mt-1 font-medium">{state.rating == null ? '—' : `${state.rating} stars`}</dd>
          </div>
          <div>
            <dt className="text-muted">Date read</dt>
            <dd className="mt-1 font-medium">{formatLibraryDate(state.dateRead)}</dd>
          </div>
          <div>
            <dt className="text-muted">Date added</dt>
            <dd className="mt-1 font-medium">{formatLibraryDate(state.dateAdded)}</dd>
          </div>
        </dl>
        {!reader ? (
          <p className="mt-3 text-sm text-muted">Sign in to keep ratings and shelves across sessions.</p>
        ) : (
          <p className="mt-3 text-sm text-sage">Saved to your Read Evermore shelves.</p>
        )}
        {book.ratingStats?.count ? (
          <p className="mt-4 text-sm">
            Read Evermore average {book.ratingStats.average} from {book.ratingStats.count} ratings. This is not a
            Goodreads score.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">No Read Evermore ratings yet.</p>
        )}
        <section className="mt-10">
          <h2 className="font-(family-name:--font-display) text-2xl">Editions in this catalog</h2>
          <ul className="mt-4 space-y-3">
            {(book.editions || []).map((edition) => (
              <li key={edition._id} className="surface px-4 py-3 text-sm">
                <p className="font-medium">
                  {edition.title || book.title}
                  {edition.firstPublicationOfBook ? ' · First publication' : ''}
                  {edition.isReprint ? ' · Reprint' : ''}
                </p>
                <p className="text-muted">
                  {[edition.format, edition.market, edition.publisher, edition.onSaleDate, edition.isbn13]
                    .filter(Boolean)
                    .join(' · ') || 'Edition details incomplete'}
                </p>
              </li>
            ))}
          </ul>
        </section>
        {book.openLibraryWorkKey ? (
          <p className="mt-6 text-sm text-muted">
            Open Library:{' '}
            <a className="underline" href={`https://openlibrary.org/works/${book.openLibraryWorkKey}`}>
              {book.openLibraryWorkKey}
            </a>
          </p>
        ) : null}
      </div>
    </article>
  )
}
