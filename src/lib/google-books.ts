export const GOOGLE_VOLUME_ID = /^[A-Za-z0-9_-]{1,40}$/

export type GoogleMoney = {
  amount?: number
  currencyCode?: string
}

export type GoogleBook = {
  id: string
  kind?: string
  etag?: string
  selfLink?: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    industryIdentifiers?: {type?: string; identifier?: string}[]
    pageCount?: number
    printedPageCount?: number
    printType?: string
    categories?: string[]
    averageRating?: number
    ratingsCount?: number
    maturityRating?: string
    language?: string
    previewLink?: string
    infoLink?: string
    canonicalVolumeLink?: string
    imageLinks?: {
      extraLarge?: string
      large?: string
      medium?: string
      small?: string
      thumbnail?: string
      smallThumbnail?: string
    }
  }
  saleInfo?: {
    country?: string
    saleability?: string
    isEbook?: boolean
    listPrice?: GoogleMoney
    retailPrice?: GoogleMoney
    buyLink?: string
  }
  accessInfo?: {
    country?: string
    viewability?: string
    embeddable?: boolean
    publicDomain?: boolean
    epub?: {isAvailable?: boolean}
    pdf?: {isAvailable?: boolean}
    webReaderLink?: string
    accessViewStatus?: string
  }
  searchInfo?: {
    textSnippet?: string
  }
}

export type GoogleSearchResponse = {
  items?: GoogleBook[]
  totalItems?: number
  error?: string
}

export function secureImageUrl(url?: string) {
  return url ? url.replace(/^http:\/\//, 'https://') : undefined
}

export function coverSrc(book: GoogleBook) {
  const images = book.volumeInfo?.imageLinks
  const url = secureImageUrl(
    images?.extraLarge ||
      images?.large ||
      images?.medium ||
      images?.small ||
      images?.thumbnail ||
      images?.smallThumbnail,
  )
  return url ? url.replace(/zoom=\d/, 'zoom=3').replace(/&edge=curl/, '') : url
}

export function bookTitle(book: GoogleBook) {
  return book.volumeInfo?.title || 'Untitled'
}

export function plainText(html?: string) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatMoney(price?: GoogleMoney) {
  if (price?.amount == null) return undefined
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currencyCode || 'USD',
    }).format(price.amount)
  } catch {
    return `${price.amount} ${price.currencyCode || ''}`.trim()
  }
}
