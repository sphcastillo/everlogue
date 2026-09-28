export type CoverSource = {
  isbn10?: string | null
  isbn13?: string | null
  cover?: {url?: string | null; source?: string | null} | null
  coverUrl?: string | null
  coverOpenLibraryId?: string | null
  coverOverride?: {asset?: {_id?: string; _ref?: string; url?: string}; alt?: string} | null
}

export function openLibraryCover(isbn: string) {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
}

export function hasManualCover(cover?: CoverSource | null) {
  const asset = cover?.coverOverride?.asset
  return Boolean(asset?._id || asset?._ref || asset?.url)
}

export function catalogCover(book: {
  isbn10?: string | null
  isbn13?: string | null
  cover?: CoverSource['cover']
  coverUrl?: string | null
  edition?: CoverSource | null
  coverOverride?: CoverSource['coverOverride']
}): CoverSource {
  const edition = book.edition
  return {
    ...edition,
    isbn10: edition?.isbn10 || book.isbn10,
    isbn13: edition?.isbn13 || book.isbn13,
    cover: edition?.cover || book.cover,
    coverUrl: edition?.coverUrl || book.coverUrl || book.cover?.url,
    coverOverride: book.coverOverride || edition?.coverOverride,
  }
}

export function coverCandidates(cover?: CoverSource | null, manualUrl?: string | null) {
  const id = cover?.coverOpenLibraryId?.replace(/^\/?(books|works|authors)\//, '')
  return [...new Set([
    manualUrl || cover?.coverOverride?.asset?.url,
    cover?.cover?.url,
    cover?.coverUrl,
    id ? `https://covers.openlibrary.org/b/${/^\d+$/.test(id) ? 'id' : 'olid'}/${encodeURIComponent(id)}-L.jpg?default=false` : null,
    cover?.isbn13 ? openLibraryCover(cover.isbn13) : cover?.isbn10 ? openLibraryCover(cover.isbn10) : null,
  ].filter((url): url is string => Boolean(url)).map((url) => {
    if (!url.startsWith('https://covers.openlibrary.org/')) return url
    const normalized = new URL(url)
    normalized.searchParams.set('default', 'false')
    return normalized.toString()
  }))]
}
