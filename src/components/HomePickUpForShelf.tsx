import {getOptionalReader} from '@/lib/reader'
import {privateClient, noStore} from '@/sanity/client'
import {fetchCatalog} from '@/sanity/fetch'
import {FOR_YOU_BOOKS_QUERY, SHELF_PICK_GENRES, SHELF_PICKS_QUERY} from '@/sanity/queries'
import {hasManualCover} from '@/lib/book-covers'
import {rankForYouBooks, type ForYouTaste} from '@/lib/for-you-picks'
import {loadHomeShelfData} from '@/lib/home-shelf-data'
import {ReaderSetupRecovery} from './ReaderSetupRecovery'
import {HomePickUpForShelfPicks, type ShelfPickBook, type ShelfPickTab} from './HomePickUpForShelfPicks'

const PUBLIC_TABS = [
  {id: 'strange', label: 'A little strange', slug: 'a-little-strange', source: 'strange' as const},
  {id: 'feelings', label: 'Big feelings', slug: 'big-feelings', source: 'feelings' as const},
  {id: 'short', label: 'Short & sharp', slug: 'short-and-sharp', source: 'short' as const},
]

class ReaderUnavailableError extends Error {}

export default async function HomePickUpForShelf() {
  // Preserve setup failure as a distinct state, never treat it as a guest.
  const data = await loadHomeShelfData(
    () => getOptionalReader().catch(() => { throw new ReaderUnavailableError() }),
    () => fetchCatalog<{
      collections: {slug?: string | null; books?: ShelfPickBook[] | null}[] | null
      strange: ShelfPickBook[] | null
      feelings: ShelfPickBook[] | null
      short: ShelfPickBook[] | null
    }>(SHELF_PICKS_QUERY, {
      strangeGenres: SHELF_PICK_GENRES.strange,
      feelingsGenres: SHELF_PICK_GENRES.feelings,
      shortGenres: SHELF_PICK_GENRES.short,
    }),
    reader => privateClient.fetch<{
      books: ShelfPickBook[] | null
      hasLibrary: boolean
      taste?: ForYouTaste | null
    }>(
      FOR_YOU_BOOKS_QUERY,
      {readerId: reader.readerId},
      noStore,
    ).then((personal) => ({
      books: rankForYouBooks(validBooks(personal.books), personal.taste ?? {}),
      hasLibrary: personal.hasLibrary,
    })),
  ).catch(error => {
    if (error instanceof ReaderUnavailableError) return null
    throw error
  })

  if (!data) return <ReaderSetupRecovery />
  const {reader, picks, books, hasLibrary} = data

  const publicTabs: ShelfPickTab[] = PUBLIC_TABS.map((tab) => {
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
      picks.collections?.find(
        (collection) => collection.slug === tab.slug,
      )?.books,
    )

    const fromFilter = eligible(picks[tab.source])

    return {
      id: tab.id,
      label: tab.label,
      books: uniqueTake(fromCollection, fromFilter),
    }
  })

  const forYou = books

  const visiblePublic = publicTabs.filter((tab) => tab.books.length)
  const tabs: ShelfPickTab[] = hasLibrary
    ? [{id: 'forYou', label: 'For you', books: forYou}, ...visiblePublic]
    : visiblePublic

  if (!tabs.some((tab) => tab.books.length)) return null

  return <HomePickUpForShelfPicks signedIn={Boolean(reader)} tabs={tabs} />
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
