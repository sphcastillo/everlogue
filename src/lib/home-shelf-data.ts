import {rankForYouBooks, type ForYouCandidate, type ForYouTaste} from './for-you-picks'

export type ForYouTastePayload = {
  hasLibrary: boolean
  excludeIds?: (string | null)[] | null
  taste?: ForYouTaste | null
}

function uniqueStrings(values?: (string | null)[] | null) {
  return [...new Set((values ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
}

/** Taste first, then a parametrized candidate query. Skip candidates when there is no shelf taste. */
export async function loadForYouShelf<T extends ForYouCandidate>(
  loadTaste: () => Promise<ForYouTastePayload>,
  loadCandidates: (params: {
    excludeIds: string[]
    genres: string[]
    authors: string[]
  }) => Promise<T[] | null>,
) {
  const personal = await loadTaste()
  if (!personal.hasLibrary) return {books: [] as T[], hasLibrary: false}

  const genres = uniqueStrings(personal.taste?.genres)
  const authors = uniqueStrings(personal.taste?.authors)
  if (!genres.length && !authors.length) return {books: [] as T[], hasLibrary: true}

  const books = await loadCandidates({
    excludeIds: uniqueStrings(personal.excludeIds),
    genres,
    authors,
  })
  return {
    books: rankForYouBooks<T>(books ?? [], personal.taste ?? {}),
    hasLibrary: true,
  }
}

/** Public shelf rows and reader identity in parallel; For You loads after paint. */
export async function loadHomePublicShelf<R, P>(
  loadReader: () => Promise<R | null>,
  loadPublic: () => Promise<P>,
) {
  const [picks, reader] = await Promise.all([loadPublic(), loadReader()])
  return {picks, reader}
}

/** Start public data immediately; only personalized data depends on the reader.
 * Promise.all attaches rejection handlers to both branches immediately.
 * This is request-local orchestration, not a cache of reader/library data.
 */
export async function loadHomeShelfData<R, P, B>(
  loadReader: () => Promise<R | null>,
  loadPublic: () => Promise<P>,
  loadPersonal: (reader: R) => Promise<{books: B[]; hasLibrary: boolean}>,
) {
  const [picks, personal] = await Promise.all([
    loadPublic(),
    loadReader().then(async reader => {
      if (!reader) return {reader: null, books: [] as B[], hasLibrary: false}
      const loaded = await loadPersonal(reader)
      return {reader, books: loaded.books, hasLibrary: loaded.hasLibrary}
    }),
  ])
  return {picks, ...personal}
}
