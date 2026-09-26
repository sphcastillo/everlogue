import {notFound} from 'next/navigation'
import Link from 'next/link'
import {fetchCatalog} from '@/sanity/fetch'
import {bookCardFields} from '@/sanity/queries'
import {BookCard, type BookCardData} from '@/components/BookCard'
import {EmptyState} from '@/components/States'
import {PageHeader} from '@/components/PageHeader'

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
    <div>
      <PageHeader eyebrow={genreDoc.parent?.title || 'Browse'} title={genreDoc.title} lede={genreDoc.description} />
      {subgenres.length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {subgenres.map((item) => (
            <Link key={item.slug} href={`/browse/${item.slug}`} className="pill px-3 py-1 text-sm">
              {item.title}
            </Link>
          ))}
        </div>
      ) : null}
      {genre === 'fantasy' ? (
        <p className="mt-6">
          <Link href="/browse/fantasy/2024" className="pill px-4 py-2 text-sm">
            Highly rated fantasy by year
          </Link>
        </p>
      ) : null}
      {books.length ? (
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book._id} book={book} fill />
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState title="No books in this genre yet" body="This is a full genre page. When more verified books are imported, they will appear here." />
        </div>
      )}
      <div className="mt-8 flex gap-3">
        {page > 1 ? (
          <Link href={`/browse/${genre}?page=${page - 1}`} className="pill px-4 py-2 text-sm">
            Previous
          </Link>
        ) : null}
        {start + books.length < total ? (
          <Link href={`/browse/${genre}?page=${page + 1}`} className="pill px-4 py-2 text-sm">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  )
}
