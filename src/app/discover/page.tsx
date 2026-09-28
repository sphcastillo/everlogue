import {fetchCatalog} from '@/sanity/fetch'
import {CURATED_COLLECTIONS_QUERY, DISCOVER_COLLECTIONS_QUERY} from '@/sanity/queries'
import type {CarouselCollection} from '@/components/CollectionCarousel'
import DiscoverHero from '@/components/DiscoverHero'

export default async function DiscoverPage() {
  const [collections, curated] = await Promise.all([
    fetchCatalog<{_id: string}[]>(DISCOVER_COLLECTIONS_QUERY),
    fetchCatalog<CarouselCollection[]>(CURATED_COLLECTIONS_QUERY),
  ])

  return (
    <DiscoverHero
      collections={curated ?? []}
      hasShelves={Boolean(curated?.length || collections?.length)}
    />
  )
}
