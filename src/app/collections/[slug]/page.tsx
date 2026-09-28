import Link from 'next/link'
import {notFound} from 'next/navigation'
import {fetchCatalog} from '@/sanity/fetch'
import {COLLECTION_BY_SLUG_QUERY, CURATED_COLLECTION_BY_SLUG_QUERY} from '@/sanity/queries'
import {BookCard, type BookCardData} from '@/components/BookCard'
import {BookCover} from '@/components/BookCover'
import {PageHeader} from '@/components/PageHeader'
import {clubSelectionLabel} from '@/lib/club-selection-dates'
import {collectionTypeLabel} from '@/lib/collection-type'
import type {CarouselCollection} from '@/components/CollectionCarousel'
import {catalogCover} from '@/lib/book-covers'

export default async function CollectionPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params
  const [editorial, curated] = await Promise.all([
    fetchCatalog<{
      title: string
      description?: string
      editorialLabel?: string
      books?: BookCardData[]
    } | null>(COLLECTION_BY_SLUG_QUERY, {slug}),
    fetchCatalog<CarouselCollection | null>(CURATED_COLLECTION_BY_SLUG_QUERY, {slug}),
  ])

  if (editorial) {
    return (
      <div>
        <PageHeader eyebrow="Collection" title={editorial.title} lede={editorial.description} />
        {editorial.editorialLabel ? (
          <p className="pill mt-4 inline-block px-3 py-1 text-sm">{editorial.editorialLabel}</p>
        ) : null}
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {(editorial.books || []).map((book) => (
            <BookCard key={book._id} book={book} fill />
          ))}
        </div>
      </div>
    )
  }

  if (!curated) notFound()

  const entries = curated.books.filter((entry) => entry.book)
  const count = curated.totalSelections || entries.length

  return (
    <div>
      <p className="pill inline-block px-3 py-1 text-xs font-medium uppercase tracking-[0.14em]">
        {collectionTypeLabel(curated.collectionType)}
      </p>
      <PageHeader
        eyebrow={curated.curator?.name ? `Curated by ${curated.curator.name}` : 'Collection'}
        title={curated.title}
        lede={curated.description ?? undefined}
      />
      <p className="mt-4 text-sm text-muted">{count} selections</p>
      <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {entries.map((entry) => {
          const book = entry.book!
          const href = `/books/${book.slug || book._id}`
          const year = book.publishedDate?.slice(0, 4)
          const selected = clubSelectionLabel(curated, entry)
          return (
            <Link key={`${entry.selectionNumber}-${book._id}`} href={href} className="group block">
              <div className="relative">
                {selected ? (
                  <span className="absolute left-2 top-2 z-10 whitespace-nowrap rounded-full bg-[var(--ink)] px-2 py-0.5 text-[11px] font-medium text-[var(--paper)]">
                    {selected}
                  </span>
                ) : null}
                <BookCover cover={catalogCover(book)} title={book.title} className="aspect-[2/3] w-full" />
              </div>
              <p className="mt-3 font-medium leading-snug">{book.title}</p>
              <p className="mt-0.5 text-sm text-muted">
                {book.authors?.filter(Boolean).join(', ') || 'Author unknown'}
              </p>
              {year ? <p className="mt-1 text-xs text-muted">{year}</p> : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
