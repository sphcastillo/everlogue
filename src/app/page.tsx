import {HomeHero} from '@/components/HomeHero'
import {getOptionalReader} from '@/lib/reader'
import {fetchCatalog} from '@/sanity/fetch'
import {CURATED_COLLECTIONS_QUERY} from '@/sanity/queries'
import type {CarouselCollection} from '@/components/CollectionCarousel'

export default async function HomePage() {
  const [reader, curated] = await Promise.all([
    getOptionalReader().catch(() => null),
    fetchCatalog<CarouselCollection[]>(CURATED_COLLECTIONS_QUERY),
  ])

  const collection = curated?.find((item) => item.slug === 'reeses-book-club') ?? curated?.[0]
  const book = collection?.books.find((entry) => entry.book)?.book

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
              cover: book.edition || {...book, coverUrl: book.cover?.url},
              collectionTitle: collection?.title,
            }
          : null
      }
    />
  )
}
