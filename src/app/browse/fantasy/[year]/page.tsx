import Link from 'next/link'
import {fetchCatalog} from '@/sanity/fetch'
import {SITE_SETTINGS_QUERY, bookCardFields} from '@/sanity/queries'
import {BookCard, type BookCardData} from '@/components/BookCard'
import {EmptyState} from '@/components/States'
import {PageHeader} from '@/components/PageHeader'

export default async function FantasyByYearPage({params}: {params: Promise<{year: string}>}) {
  const {year: yearParam} = await params
  const year = Number(yearParam)
  if (!Number.isInteger(year)) {
    return <EmptyState title="Choose a year" body="Fantasy by Year needs a four-digit publication year." />
  }

  const settings = await fetchCatalog<{ratingMethod?: string; minimumRatingCount?: number} | null>(
    SITE_SETTINGS_QUERY,
  )
  const minimum = settings?.minimumRatingCount || 3

  const ranked = await fetchCatalog<BookCardData[]>(
    `*[_type == "book" && firstPublicationYear == $year && "fantasy" in genres[]->slug.current && ratingStats.count >= $minimum] | order(ratingStats.average desc, title asc){ ${bookCardFields} }`,
    {year, minimum},
  )
  const editorial = await fetchCatalog<{
    title?: string
    slug?: string
    editorialLabel?: string
    description?: string
    books?: BookCardData[]
  } | null>(
    `*[_type == "editorialCollection" && kind == "fantasyByYear" && year == $year && workflowStatus == "approved"][0]{
      title, "slug": slug.current, editorialLabel, description, "books": books[]->{ ${bookCardFields} }
    }`,
    {year},
  )

  const years = Array.from({length: 12}, (_, index) => 2026 - index)

  return (
    <div>
      <PageHeader eyebrow="Fantasy by year" title={String(year)} lede={settings?.ratingMethod} />
      <p className="mt-2 text-sm text-muted">
        Minimum rating count for the ranked list: {minimum}. Source: Everlogue ratings only.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {years.map((item) => (
          <Link
            key={item}
            href={`/browse/fantasy/${item}`}
            className={`pill px-3 py-1 text-sm ${item === year ? 'is-active' : ''}`}
          >
            {item}
          </Link>
        ))}
      </div>
      {ranked.length ? (
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {ranked.map((book) => (
            <BookCard key={book._id} book={book} fill />
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState
            title="Not enough Everlogue ratings yet"
            body={`No fantasy book first published in ${year} currently has at least ${minimum} in-app ratings. We do not invent community scores.`}
          />
        </div>
      )}
      {editorial?.books?.length ? (
        <section className="mt-12">
          <p className="pill inline-block px-3 py-1 text-sm">
            {editorial.editorialLabel || 'Editorial collection — not a community ranking'}
          </p>
          <h2 className="mt-3 font-display text-3xl">{editorial.title}</h2>
          <p className="mt-2 text-muted">{editorial.description}</p>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
            {editorial.books.map((book) => (
              <BookCard key={book._id} book={book} fill />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
