export const CATALOG_SOURCE_LABELS = {
  readerSearch: 'Reader search',
  goodreadsImport: 'Goodreads import',
  bookClubImport: 'Book club import',
} as const

export type CatalogSource = keyof typeof CATALOG_SOURCE_LABELS

export function publishedDocumentId(id?: string | null) {
  return (id || '').replace(/^drafts\./, '')
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
