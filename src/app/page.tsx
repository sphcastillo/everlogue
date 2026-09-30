import HomeCatalogGrowth from '@/components/HomeCatalogGrowth'
import {HomeHero} from '@/components/HomeHero'
import HomePickUpForShelf from '@/components/HomePickUpForShelf'
import {getOptionalReader} from '@/lib/reader'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const reader = await getOptionalReader().catch(() => null)

  return (
    <>
      <HomeHero displayName={reader?.displayName} signedIn={Boolean(reader)} />
      <HomePickUpForShelf />
      <HomeCatalogGrowth />
    </>
  )
}
