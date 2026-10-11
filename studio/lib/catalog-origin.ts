import {CLUBS} from '../../src/lib/book-club-watch/model'

export const CATALOG_SOURCE_LABELS = {
  readerSearch: 'Reader search',
  goodreadsImport: 'Goodreads import',
  bookClubImport: 'Book club import',
} as const

export type CatalogSource = keyof typeof CATALOG_SOURCE_LABELS

/** Collections after publish, plus Watch discoveries still in review. */
export const CATALOG_CLUBS_QUERY = `{
  "clubs": *[_type == "curatedCollection" && count(books[book._ref == $bookId]) > 0].title,
  "celebrity": *[_type == "celebritySelection" && count(books[_ref == $bookId]) > 0].club->title,
  "watch": *[_type == "bookClubDiscovery" && !(_id in path("drafts.**")) && (
    catalogBook._ref == $bookId || publishedBook._ref == $bookId
  )].bookClub,
  "linked": *[_id in [$bookId, "drafts." + $bookId]].watchDiscovery->bookClub
}`

export type CatalogClubLookup = {
  clubs?: string[] | null
  celebrity?: string[] | null
  watch?: Array<string | null> | null
  linked?: Array<string | null> | null
}

export function publishedDocumentId(id?: string | null) {
  return (id || '').replace(/^drafts\./, '')
}

export function uniqueNames(values: unknown[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value && String(value).trim())))]
}

export function watchClubTitle(bookClub?: string | null) {
  if (!bookClub) return ''
  return CLUBS[bookClub as keyof typeof CLUBS]?.name || ''
}

export function catalogClubNames(result?: CatalogClubLookup | null) {
  return uniqueNames([
    ...(result?.clubs || []),
    ...(result?.celebrity || []),
    ...(result?.watch || []).map(watchClubTitle),
    ...(result?.linked || []).map(watchClubTitle),
  ])
}

export function inferCatalogSource({
  catalogSource,
  importKey,
  documentId,
  clubNames,
}: {
  catalogSource?: string | null
  importKey?: string | null
  documentId?: string | null
  clubNames?: string[]
}): CatalogSource | null {
  if (catalogSource && catalogSource in CATALOG_SOURCE_LABELS) {
    return catalogSource as CatalogSource
  }
  if (importKey) return 'goodreadsImport'
  const id = publishedDocumentId(documentId)
  if (id.startsWith('book.google.') || (clubNames && clubNames.length)) return 'bookClubImport'
  return null
}
