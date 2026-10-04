export type ForYouTaste = {
  genres?: (string | null)[] | null
  lovedGenres?: (string | null)[] | null
  authors?: (string | null)[] | null
}

export type ForYouCandidate = {
  _id: string
  authors?: (string | null)[] | null
  genres?: {title?: string | null}[] | null
  ratingStats?: {count?: number | null} | null
}

function key(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

function overlap(values: (string | null | undefined)[], preferred: Set<string>) {
  return values.reduce((count, value) => count + (preferred.has(key(value)) ? 1 : 0), 0)
}

function score(book: ForYouCandidate, genres: Set<string>, loved: Set<string>, authors: Set<string>) {
  return {
    loved: overlap((book.genres ?? []).map((item) => item?.title), loved),
    genre: overlap((book.genres ?? []).map((item) => item?.title), genres),
    author: overlap(book.authors ?? [], authors),
    ratings: book.ratingStats?.count ?? 0,
  }
}

export function rankForYouBooks<T extends ForYouCandidate>(
  books: T[],
  taste: ForYouTaste,
  limit = 10,
) {
  const genres = new Set((taste.genres ?? []).map(key).filter(Boolean))
  const loved = new Set((taste.lovedGenres ?? []).map(key).filter(Boolean))
  const authors = new Set((taste.authors ?? []).map(key).filter(Boolean))

  return [...books].sort((left, right) => {
    const a = score(left, genres, loved, authors)
    const b = score(right, genres, loved, authors)
    return b.loved - a.loved || b.genre - a.genre || b.author - a.author || b.ratings - a.ratings
  }).slice(0, limit)
}
