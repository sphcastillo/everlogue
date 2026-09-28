import {fetchCatalog} from '@/sanity/fetch'
import {CURATED_COLLECTIONS_QUERY, DISCOVER_COLLECTIONS_QUERY} from '@/sanity/queries'
import {CollectionCarousel, type CarouselCollection} from '@/components/CollectionCarousel'
import {EmptyState} from '@/components/States'

export default async function DiscoverPage() {
  const [collections, curated] = await Promise.all([
    fetchCatalog<{_id: string}[]>(DISCOVER_COLLECTIONS_QUERY),
    fetchCatalog<CarouselCollection[]>(CURATED_COLLECTIONS_QUERY),
  ])

  const hasShelves = Boolean(curated?.length || collections?.length)

  return (
    <div className="p-8">
      <h1 className="font-display text-[2.15rem] leading-[1.05] tracking-[-0.03em] sm:text-4xl">
        The Book Club Spotlight
      </h1>

      <div className="mt-8 space-y-6">
        {curated?.map((collection) => (
          <CollectionCarousel key={collection._id} collection={collection} />
        ))}

        {!hasShelves ? (
          <EmptyState
            title="The shelves are still being set"
            body="No editorial collections are published yet. Search books to find your next read."
          />
        ) : null}
      </div>
    </div>
  )
}
