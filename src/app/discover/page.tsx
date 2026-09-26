import {fetchCatalog} from '@/sanity/fetch'
import {CURATED_COLLECTIONS_QUERY, DISCOVER_COLLECTIONS_QUERY, SITE_SETTINGS_QUERY} from '@/sanity/queries'
import {CollectionRow} from '@/components/CollectionRow'
import {CollectionCarousel, type CarouselCollection} from '@/components/CollectionCarousel'
import {EmptyState} from '@/components/States'
import {collectionTypeLabel} from '@/lib/collection-type'

export default async function DiscoverPage() {
  const [settings, collections, curated] = await Promise.all([
    fetchCatalog<{
      tagline?: string
      catalogDisclaimer?: string
      openLibraryAttribution?: string
    } | null>(SITE_SETTINGS_QUERY),
    fetchCatalog<
      {
        _id: string
        title: string
        slug?: string
        description?: string
        books?: Parameters<typeof CollectionRow>[0]['books']
      }[]
    >(DISCOVER_COLLECTIONS_QUERY),
    fetchCatalog<CarouselCollection[]>(CURATED_COLLECTIONS_QUERY),
  ])

  const reesesBookClub = curated?.find((collection) => collection.slug === 'reeses-book-club')
  const otherCuratedCollections = curated?.filter((collection) => collection._id !== reesesBookClub?._id)
  const headingCollection = reesesBookClub ?? curated?.[0]
  const hasShelves = Boolean(curated?.length || collections?.length)

  return (
    <div>
      {headingCollection ? (
        <h1 className="pl-4 font-display text-[2.15rem] leading-[1.05] tracking-[-0.03em] sm:text-4xl">
          {collectionTypeLabel(headingCollection.collectionType)}
        </h1>
      ) : null}
      <div className="mt-8 space-y-6">
        {reesesBookClub ? <CollectionCarousel collection={reesesBookClub} /> : null}
        {otherCuratedCollections?.length
          ? otherCuratedCollections.map((collection) => <CollectionCarousel key={collection._id} collection={collection} />)
          : null}
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
