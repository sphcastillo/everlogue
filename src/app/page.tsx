import BringYourGoodReads from '@/components/BringYourGoodReads'
import GoodTasteTravels from '@/components/GoodTasteTravels'
import HomeCatalogGrowth from '@/components/HomeCatalogGrowth'
import {HomeHero} from '@/components/HomeHero'
import HomePickUpForShelf from '@/components/HomePickUpForShelf'
import {getOptionalReader} from '@/lib/reader'
import {auth} from '@clerk/nextjs/server'
import {Suspense} from 'react'
import {HomeGreeting} from '@/components/HomeGreeting'

export const dynamic = 'force-dynamic'

async function ReaderGreeting() {
  const reader = await getOptionalReader().catch(() => null)
  return <HomeGreeting displayName={reader?.displayName} />
}

function SectionLoading({label}: {label: string}) {
  return <section role="status" aria-busy="true" className="min-h-80 border-t border-(--line) px-5 py-16 min-[875px]:px-9">
    <p className="text-sm text-muted">{label}</p>
  </section>
}

export default async function HomePage() {
  const {isAuthenticated} = await auth()

  return (
    <>
      <HomeHero signedIn={isAuthenticated} greeting={
        <Suspense fallback={<HomeGreeting />}><ReaderGreeting /></Suspense>
      } />
      <Suspense fallback={<SectionLoading label="Finding books for your shelf…" />}>
        <HomePickUpForShelf />
      </Suspense>
      <Suspense fallback={<SectionLoading label="Loading the latest from readers…" />}>
        <GoodTasteTravels />
      </Suspense>
      <HomeCatalogGrowth />
      <BringYourGoodReads />
    </>
  )
}
