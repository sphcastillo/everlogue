import {notFound} from 'next/navigation'
import {fetchCatalog} from '@/sanity/fetch'
import {COLLECTION_BY_SLUG_QUERY, CURATED_COLLECTION_BY_SLUG_QUERY} from '@/sanity/queries'
import {type BookCardData} from '@/components/BookCard'
import {ClubCollectionView} from '@/components/ClubCollectionView'
import type {CarouselCollection} from '@/components/CollectionCarousel'
import {catalogCover} from '@/lib/book-covers'
import {latestClubEntries} from '@/lib/club-books'

export const dynamic = 'force-dynamic'

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
    const books = editorial.books || []
    return (
      <ClubCollectionView
        title={editorial.title}
        description={editorial.description}
        collectionType="editorial"
        totalCount={books.length}
        items={books.map((book) => ({
          key: book._id,
          href: `/books/${book.slug || book._id}?club=${encodeURIComponent(slug)}`,
          title: book.title,
          authors: book.authors?.filter(Boolean).join(', ') || 'Author unknown',
          description: book.description,
          cover: book.cover,
        }))}
      />
    )
  }

  if (!curated) notFound()

  const entries = latestClubEntries(curated.books)
  const count = curated.totalSelections ?? entries.length

  return (
    <ClubCollectionView
      title={curated.title}
      description={curated.description}
      curatorName={curated.curator?.name}
      image={curated.image}
      instagramUrl={curated.instagramUrl}
      collectionType={curated.collectionType}
      totalCount={count}
      items={entries.map((entry) => {
        const book = entry.book!
        return {
          key: `${entry.selectionNumber}-${book._id}`,
          selectionNumber: entry.selectionNumber,
          href: `/books/${book.slug || book._id}?club=${encodeURIComponent(slug)}`,
          title: book.title,
          authors: book.authors?.filter(Boolean).join(', ') || 'Author unknown',
          description: book.description,
          cover: catalogCover(book),
        }
      })}
    />
  )
}
