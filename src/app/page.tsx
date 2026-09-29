import {HomeHero} from '@/components/HomeHero'
import {getOptionalReader} from '@/lib/reader'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const reader = await getOptionalReader().catch(() => null)

  return <HomeHero displayName={reader?.displayName} />
}
