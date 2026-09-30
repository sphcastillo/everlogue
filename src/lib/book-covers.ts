export type CoverSource = {
  isbn10?: string | null
  isbn13?: string | null
  cover?: {url?: string | null; source?: string | null} | null
  coverUrl?: string | null
  coverOpenLibraryId?: string | null
  needsCover?: boolean | null
  coverOverride?: {asset?: {_id?: string; _ref?: string; url?: string}; alt?: string} | null
}

export function openLibraryCover(isbn: string) {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
}

export function hasManualCover(cover?: CoverSource | null) {
  const asset = cover?.coverOverride?.asset
  return Boolean(asset?._id || asset?._ref || asset?.url)
}

const PLACEHOLDERS = [
  '/images/cover-placeholders/1.png',
  '/images/cover-placeholders/2.png',
  '/images/cover-placeholders/3.png',
  '/images/cover-placeholders/4.png',
  '/images/cover-placeholders/5.png',
] as const

/** Stable pick so the same book keeps the same placeholder, spread evenly across the set. */
export function placeholderCoverSrc(seed: string) {
  const key = seed.trim() || 'everlogue'
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return PLACEHOLDERS[(hash >>> 0) % PLACEHOLDERS.length]
}

export function catalogCover(book: {
  isbn10?: string | null
  isbn13?: string | null
  cover?: CoverSource['cover']
  coverUrl?: string | null
  edition?: CoverSource | null
  coverOverride?: CoverSource['coverOverride']
  needsCover?: boolean | null
}): CoverSource {
  const edition = book.edition
  return {
    ...edition,
    isbn10: edition?.isbn10 || book.isbn10,
    isbn13: edition?.isbn13 || book.isbn13,
    cover: edition?.cover || book.cover,
    coverUrl: edition?.coverUrl || book.coverUrl || book.cover?.url,
    coverOverride: book.coverOverride || edition?.coverOverride,
    needsCover: edition?.needsCover ?? book.needsCover,
  }
}

export function hiResCoverUrl(url: string) {
  try {
    const parsed = new URL(url.replace(/^http:\/\//, 'https://'))
    if (parsed.hostname.includes('books.google') || parsed.hostname.includes('googleusercontent')) {
      parsed.searchParams.set('zoom', '3')
      parsed.searchParams.delete('edge')
    }
    if (parsed.hostname === 'covers.openlibrary.org') {
      parsed.searchParams.set('default', 'false')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function isBlankCoverUrl(url: string) {
  const value = url.toLowerCase()
  return (
    value.includes('no_cover') ||
    value.includes('nophoto') ||
    value.includes('nocover') ||
    value.includes('avatar_book') ||
    value.includes('book-cover-unavailable')
  )
}

export function displayCoverUrls(urls: string[], cover?: CoverSource | null) {
  const skipOpenLibrary = Boolean(cover?.needsCover)
  return urls.filter((url) => {
    if (isBlankCoverUrl(url)) return false
    if (skipOpenLibrary && url.includes('covers.openlibrary.org')) return false
    return true
  })
}

/** Google still 200s a gray "Image not available" graphic at these exact sizes (zoom 1 / 2 / 3). */
const GOOGLE_MISSING_COVER_SIZES = new Set(['128x188', '300x391', '575x750'])

export function isProviderPlaceholderImage(src: string, width: number, height: number) {
  if (width < 60 || height < 60) return true
  if (src.includes('covers.openlibrary.org') && width <= 180) return true
  if (
    (src.includes('books.google') || src.includes('googleusercontent')) &&
    GOOGLE_MISSING_COVER_SIZES.has(`${width}x${height}`)
  ) {
    return true
  }
  return false
}

export function coverCandidates(cover?: CoverSource | null, manualUrl?: string | null) {
  const id = cover?.coverOpenLibraryId?.replace(/^\/?(books|works|authors)\//, '')
  return [...new Set([
    manualUrl || cover?.coverOverride?.asset?.url,
    cover?.cover?.url,
    cover?.coverUrl,
    id ? `https://covers.openlibrary.org/b/${/^\d+$/.test(id) ? 'id' : 'olid'}/${encodeURIComponent(id)}-L.jpg?default=false` : null,
    cover?.isbn13 ? openLibraryCover(cover.isbn13) : cover?.isbn10 ? openLibraryCover(cover.isbn10) : null,
  ].filter((url): url is string => Boolean(url)).map(hiResCoverUrl))]
}
