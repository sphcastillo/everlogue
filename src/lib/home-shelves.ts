import 'server-only'
import {privateClient, noStore} from '@/sanity/client'
import {fetchCachedCatalog} from '@/sanity/fetch'
import {FOR_YOU_CANDIDATES_QUERY, FOR_YOU_TASTE_QUERY, SHELF_PICK_GENRES, SHELF_PICKS_QUERY} from '@/sanity/queries'
import {loadForYouShelf, type ForYouTastePayload} from './home-shelf-data'
import {publicShelfTabs, validBooks, type ShelfPicks, type ShelfPickBook, type ShelfPickTab} from './home-shelf-selection'

export async function getPublicHomeShelves(): Promise<ShelfPickTab[]> {
  const picks = await fetchCachedCatalog<ShelfPicks>(SHELF_PICKS_QUERY, {
    strangeGenres: SHELF_PICK_GENRES.strange,
    feelingsGenres: SHELF_PICK_GENRES.feelings,
    shortGenres: SHELF_PICK_GENRES.short,
  })
  return publicShelfTabs(picks).filter(tab => tab.books.length)
}

/** readerId must come from the verified server session, never request parameters. */
export async function getForYouHomeShelf(readerId: string) {
  const {books, hasLibrary} = await loadForYouShelf(
    () => privateClient.fetch<ForYouTastePayload>(FOR_YOU_TASTE_QUERY, {readerId}, noStore),
    params => privateClient.fetch<ShelfPickBook[] | null>(FOR_YOU_CANDIDATES_QUERY, params, noStore),
  )
  const tabs: ShelfPickTab[] = hasLibrary
    ? [{id: 'forYou', label: 'For you', books: validBooks(books)}]
    : []
  return {hasLibrary, tabs}
}
