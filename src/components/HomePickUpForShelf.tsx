import {Suspense} from 'react'
import {getOptionalReader, type ReaderSession} from '@/lib/reader'
import {loadHomePublicShelf} from '@/lib/home-shelf-data'
import {getPublicHomeShelves, getForYouHomeShelf} from '@/lib/home-shelves'
import type {ShelfPickTab} from '@/lib/home-shelf-selection'
import {ReaderSetupRecovery} from './ReaderSetupRecovery'
import {HomePickUpForShelfPicks} from './HomePickUpForShelfPicks'

class ReaderUnavailableError extends Error {}

export default async function HomePickUpForShelf() {
  // Public rows should paint without waiting on For You.
  const data = await loadHomePublicShelf(
    () => getOptionalReader().catch(() => { throw new ReaderUnavailableError() }),
    getPublicHomeShelves,
  ).catch((error) => {
    if (error instanceof ReaderUnavailableError) return null
    throw error
  })

  if (!data) return <ReaderSetupRecovery />

  const visiblePublic = data.picks

  if (!data.reader) {
    if (!visiblePublic.length) return null
    return <HomePickUpForShelfPicks signedIn={false} tabs={visiblePublic} />
  }

  return (
    <Suspense fallback={shelfFallback(visiblePublic, true)}>
      <HomeForYouShelf reader={data.reader} publicTabs={visiblePublic} />
    </Suspense>
  )
}

async function HomeForYouShelf({
  reader,
  publicTabs,
}: {
  reader: ReaderSession
  publicTabs: ShelfPickTab[]
}) {
  const {tabs: personalTabs} = await getForYouHomeShelf(reader.readerId)
  const tabs = [...personalTabs, ...publicTabs]

  if (!tabs.some((tab) => tab.books.length)) return null
  return <HomePickUpForShelfPicks signedIn tabs={tabs} />
}

function shelfFallback(publicTabs: ShelfPickTab[], signedIn: boolean) {
  if (!publicTabs.length) {
    return (
      <section role="status" aria-busy="true" className="min-h-80 border-t border-(--line) px-5 py-16 min-[875px]:px-9">
        <p className="text-sm text-muted">Finding books for your shelf…</p>
      </section>
    )
  }
  return <HomePickUpForShelfPicks signedIn={signedIn} tabs={publicTabs} />
}
