import {hasManualCover, type CoverSource} from './book-covers'

export type ShelfPickBook = {
  _id: string
  title: string
  slug?: string | null
  authors?: string[] | null
  cover?: CoverSource | null
  ratingStats?: {average?: number | null; count?: number | null} | null
  pageCount?: number | null
  genres?: {title?: string | null}[] | null
}

export type ShelfPickTab = {id: string; label: string; books: ShelfPickBook[]}

const PUBLIC_TABS = [
  {id: 'strange', label: 'A little strange', slug: 'a-little-strange', source: 'strange' as const},
  {id: 'feelings', label: 'Big feelings', slug: 'big-feelings', source: 'feelings' as const},
  {id: 'short', label: 'Short & sharp', slug: 'short-and-sharp', source: 'short' as const},
]

export type ShelfPicks = {
  collections: {slug?: string | null; books?: ShelfPickBook[] | null}[] | null
  strange: ShelfPickBook[] | null
  feelings: ShelfPickBook[] | null
  short: ShelfPickBook[] | null
}

export function publicShelfTabs(picks: ShelfPicks): ShelfPickTab[] {
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

export function validBooks(books?: ShelfPickBook[] | null) {
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
