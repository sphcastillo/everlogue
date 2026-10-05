import {Suspense} from 'react'
import {getOptionalReader, type ReaderSession} from '@/lib/reader'
import {privateClient, noStore} from '@/sanity/client'
import {fetchCachedCatalog} from '@/sanity/fetch'
import {
  FOR_YOU_CANDIDATES_QUERY,
  FOR_YOU_TASTE_QUERY,
  SHELF_PICK_GENRES,
  SHELF_PICKS_QUERY,
} from '@/sanity/queries'
import {hasManualCover} from '@/lib/book-covers'
import {loadForYouShelf, loadHomePublicShelf} from '@/lib/home-shelf-data'
import type {ForYouTaste} from '@/lib/for-you-picks'
import {ReaderSetupRecovery} from './ReaderSetupRecovery'
import {HomePickUpForShelfPicks, type ShelfPickBook, type ShelfPickTab} from './HomePickUpForShelfPicks'

const PUBLIC_TABS = [
  {id: 'strange', label: 'A little strange', slug: 'a-little-strange', source: 'strange' as const},
  {id: 'feelings', label: 'Big feelings', slug: 'big-feelings', source: 'feelings' as const},
  {id: 'short', label: 'Short & sharp', slug: 'short-and-sharp', source: 'short' as const},
]

class ReaderUnavailableError extends Error {}

type ShelfPicks = {
  collections: {slug?: string | null; books?: ShelfPickBook[] | null}[] | null
  strange: ShelfPickBook[] | null
  feelings: ShelfPickBook[] | null
  short: ShelfPickBook[] | null
}

export default async function HomePickUpForShelf() {
  // Public rows should paint without waiting on For You.
  const data = await loadHomePublicShelf(
    () => getOptionalReader().catch(() => { throw new ReaderUnavailableError() }),
    () => fetchCachedCatalog<ShelfPicks>(SHELF_PICKS_QUERY, {
      strangeGenres: SHELF_PICK_GENRES.strange,
      feelingsGenres: SHELF_PICK_GENRES.feelings,
      shortGenres: SHELF_PICK_GENRES.short,
    }),
  ).catch((error) => {
    if (error instanceof ReaderUnavailableError) return null
    throw error
  })

  if (!data) return <ReaderSetupRecovery />

  const publicTabs = publicShelfTabs(data.picks)
  const visiblePublic = publicTabs.filter((tab) => tab.books.length)

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
  const {books, hasLibrary} = await loadForYouShelf(
    () => privateClient.fetch<{
      hasLibrary: boolean
      excludeIds?: (string | null)[] | null
      taste?: ForYouTaste | null
    }>(FOR_YOU_TASTE_QUERY, {readerId: reader.readerId}, noStore),
    (params) => privateClient.fetch<ShelfPickBook[] | null>(
      FOR_YOU_CANDIDATES_QUERY,
      params,
      noStore,
    ),
  )

  const forYou = validBooks(books)
  const tabs: ShelfPickTab[] = hasLibrary
    ? [{id: 'forYou', label: 'For you', books: forYou}, ...publicTabs]
    : publicTabs

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

function publicShelfTabs(picks: ShelfPicks): ShelfPickTab[] {
  return PUBLIC_TABS.map((tab) => {
    const eligible = (items?: ShelfPickBook[] | null) =>
      validBooks(items).filter((book) =>
        tab.source !== 'short' ||
        (
          typeof book.pageCount === 'number' &&
          book.pageCount > 0 &&
          book.pageCount <= 250
        ),
      )

    const fromCollection = eligible(
      picks.collections?.find((collection) => collection.slug === tab.slug)?.books,
    )
    const fromFilter = eligible(picks[tab.source])

    return {
      id: tab.id,
      label: tab.label,
      books: uniqueTake(fromCollection, fromFilter),
    }
  })
}

function validBooks(books?: ShelfPickBook[] | null) {
  return (books ?? []).filter((book): book is ShelfPickBook =>
    Boolean(book?._id && book.title && hasManualCover(book.cover)),
  )
}

function uniqueTake(preferred: ShelfPickBook[], fallback: ShelfPickBook[]) {
  const next: ShelfPickBook[] = []
  const seen = new Set<string>()
  for (const book of [...preferred, ...fallback]) {
    if (seen.has(book._id)) continue
    next.push(book)
    seen.add(book._id)
    if (next.length === 10) break
  }
  return next
}
