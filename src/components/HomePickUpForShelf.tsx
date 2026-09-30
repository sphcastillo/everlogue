import {getOptionalReader} from '@/lib/reader'
import {privateClient, noStore} from '@/sanity/client'
import {fetchCatalog} from '@/sanity/fetch'
import {
  FOR_YOU_BOOKS_QUERY,
  PICK_SHELF_STATUSES_QUERY,
  SHELF_PICKS_QUERY,
} from '@/sanity/queries'
import {HomePickUpForShelfPicks, type ShelfPickBook, type ShelfPickTab} from './HomePickUpForShelfPicks'

const PUBLIC_TABS = [
  {id: 'strange', label: 'A little strange', slug: 'a-little-strange', source: 'strange' as const},
  {id: 'feelings', label: 'Big feelings', slug: 'big-feelings', source: 'feelings' as const},
  {id: 'short', label: 'Short & sharp', slug: 'short-and-sharp', source: 'short' as const},
]

export default async function HomePickUpForShelf() {
  const reader = await getOptionalReader().catch(() => null)
  const picks = await fetchCatalog<{
    collections: {slug?: string | null; books?: ShelfPickBook[] | null}[] | null
    strange: ShelfPickBook[] | null
    feelings: ShelfPickBook[] | null
    short: ShelfPickBook[] | null
    latest: ShelfPickBook[] | null
  }>(SHELF_PICKS_QUERY)

  const latest = validBooks(picks.latest)
  const used = new Set<string>()
  const publicTabs: ShelfPickTab[] = PUBLIC_TABS.map((tab) => {
    const fromCollection = validBooks(
      picks.collections?.find((collection) => collection.slug === tab.slug)?.books,
    )
    const fromFilter = validBooks(picks[tab.source])
    const books = uniqueTake(fromCollection.length ? fromCollection : fromFilter, latest, used)
    return {id: tab.id, label: tab.label, books}
  })

  let forYou: ShelfPickBook[] = []
  const shelfStatuses: Record<string, string> = {}

  if (reader) {
    forYou = validBooks(
      await privateClient.fetch<ShelfPickBook[]>(FOR_YOU_BOOKS_QUERY, {readerId: reader.readerId}, noStore),
    )
    const bookIds = [...forYou, ...publicTabs.flatMap((tab) => tab.books)].map((book) => book._id)
    if (bookIds.length) {
      const rows = await privateClient.fetch<{bookId: string; status: string}[]>(
        PICK_SHELF_STATUSES_QUERY,
        {readerId: reader.readerId, bookIds},
        noStore,
      )
      for (const row of rows ?? []) {
        if (row.bookId && row.status && !shelfStatuses[row.bookId]) {
          shelfStatuses[row.bookId] = row.status
        }
      }
    }
  }

  const visiblePublic = publicTabs.filter((tab) => tab.books.length)
  const tabs: ShelfPickTab[] = reader
    ? [{id: 'forYou', label: 'For you', books: forYou}, ...visiblePublic]
    : visiblePublic

  if (!tabs.some((tab) => tab.books.length)) return null

  return <HomePickUpForShelfPicks signedIn={Boolean(reader)} tabs={tabs} shelfStatuses={shelfStatuses} />
}

function validBooks(books?: ShelfPickBook[] | null) {
  return (books ?? []).filter((book): book is ShelfPickBook => Boolean(book?._id && book.title))
}

function uniqueTake(preferred: ShelfPickBook[], fallback: ShelfPickBook[], used: Set<string>) {
  const next: ShelfPickBook[] = []
  for (const book of [...preferred, ...fallback]) {
    if (used.has(book._id) || next.some((item) => item._id === book._id)) continue
    next.push(book)
    used.add(book._id)
    if (next.length === 5) break
  }
  return next
}
