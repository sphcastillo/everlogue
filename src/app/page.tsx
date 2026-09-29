import {HomeHero} from '@/components/HomeHero'
import {getOptionalReader} from '@/lib/reader'
import {fetchCatalog} from '@/sanity/fetch'
import {CURATED_COLLECTIONS_QUERY} from '@/sanity/queries'
import type {CarouselCollection} from '@/components/CollectionCarousel'
import {catalogCover} from '@/lib/book-covers'
import {latestClubEntries} from '@/lib/club-books'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [reader, curated] = await Promise.all([
    getOptionalReader().catch(() => null),
    fetchCatalog<CarouselCollection[]>(CURATED_COLLECTIONS_QUERY),
  ])

  const collection = curated?.find((item) => item.slug === 'reeses-book-club') ?? curated?.[0]
  const book = latestClubEntries(collection?.books || [])[0]?.book

  return (
    <HomeHero
      displayName={reader?.displayName}
      featured={
        book
          ? {
              title: book.title,
              href: book.slug
                ? `/books/${book.slug}`
                : collection?.slug
                  ? `/collections/${collection.slug}`
                  : '/discover',
              authors: book.authors,
              cover: catalogCover(book),
              collectionTitle: collection?.title,
            }
          : null
      }
    />
  )
}
