import {coverSrc, type GoogleBook, type GoogleSearchResponse} from './google-books'
import {normalizeIsbn} from './isbn'
import {openLibraryCover} from './book-covers'

export type EditionInput = {title: string; author: string; isbn10?: string; isbn13?: string; goodreadsId?: string}
export type EditionMetadata = {
  isbn10?: string; isbn13?: string; googleBooksId?: string; publisher?: string; publicationDate?: string
  title?: string; authors?: string[]; pageCount?: number; language?: string; format?: string
  translators?: string[]; editionStatement?: string; openLibraryEditionKey?: string; openLibraryWorkKey?: string
  cover?: {url: string; source: 'google' | 'openLibrary'}
  needsCover: boolean
}
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
export function isbn13For(isbn: string) {
  isbn = isbn.replace(/[\s-]/g, '').toUpperCase()
  if (isbn.length !== 10) return isbn
  const body = `978${isbn.slice(0, 9)}`
  const sum = [...body].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0)
  return `${body}${(10 - sum % 10) % 10}`
}

export function matchGoogleEdition(input: EditionInput, items: GoogleBook[]) {
  const isbn = input.isbn13 || (input.isbn10 ? isbn13For(input.isbn10) : undefined)
  const matches = items.filter((book) => {
    const info = book.volumeInfo
    if (isbn) return info?.industryIdentifiers?.some((id) => id.identifier && isbn13For(id.identifier) === isbn)
    return normalize(info?.title || '') === normalize(input.title) && info?.authors?.some((author) => normalize(author) === normalize(input.author))
  })
  // An ISBN fixes the edition. With only a title/author, choose a representative
  // matching edition and retain its identifiers rather than mixing editions.
  return isbn ? matches[0] : matches.find((book) => coverSrc(book)) || matches[0]
}

let nextOpenLibraryRequest = 0
async function paceOpenLibrary() {
  const now = Date.now()
  const scheduled = Math.max(now, nextOpenLibraryRequest)
  nextOpenLibraryRequest = scheduled + 3100
  if (scheduled > now) await new Promise((resolve) => setTimeout(resolve, scheduled - now))
}

export async function resolveEditionMetadata(
  input: EditionInput,
  options: {fetcher?: typeof fetch; googleKey?: string; pace?: () => Promise<void>} = {},
): Promise<EditionMetadata> {
  input = {...input, isbn13: input.isbn13 ? isbn13For(input.isbn13) : undefined, isbn10: input.isbn10?.replace(/[\s-]/g, '').toUpperCase()}
  const fetcher = options.fetcher || fetch
  const result: EditionMetadata = {isbn10: input.isbn10, isbn13: input.isbn13 || (input.isbn10 ? isbn13For(input.isbn10) : undefined), needsCover: true}
  const googleKey = options.googleKey ?? process.env.GOOGLE_BOOKS_API_KEY
  let google: GoogleBook | undefined
  try {
    if (googleKey) {
      const isbn = input.isbn13 || input.isbn10
      const query = isbn ? `isbn:${isbn}` : `intitle:${input.title} inauthor:${input.author}`
      const response = await fetcher(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`, {
        headers: {'x-goog-api-key': googleKey}, next: {revalidate: 86400}, signal: AbortSignal.timeout(5000),
      })
      if (response.ok) google = matchGoogleEdition(input, ((await response.json()) as GoogleSearchResponse).items || [])
    }
  } catch { /* Metadata outages must not prevent a library import. */ }
  if (google) {
    const info = google.volumeInfo!
    const ids = info.industryIdentifiers || []
    result.isbn10 ||= ids.find((id) => id.type === 'ISBN_10' && /^\d{9}[\dX]$/.test(id.identifier || ''))?.identifier
    result.isbn13 ||= ids.find((id) => id.type === 'ISBN_13' && /^\d{13}$/.test(id.identifier || ''))?.identifier
    result.title = info.title
    result.authors = info.authors
    result.pageCount = info.pageCount
    result.language = info.language
    if (google.saleInfo?.isEbook) result.format = 'ebook'
    result.googleBooksId = google.id
    result.publisher = info.publisher
    result.publicationDate = info.publishedDate
  }
  const isbn = result.isbn13 && normalizeIsbn(result.isbn13)
  if (isbn && (!result.publisher || !result.language || !result.pageCount || !result.format)) {
    try {
      await (options.pace || paceOpenLibrary)()
      const response = await fetcher(`https://openlibrary.org/isbn/${isbn}.json`, {
        next: {revalidate: 86400}, signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        const edition = await response.json() as {
          key?: string; title?: string; isbn_13?: string[]; isbn_10?: string[]; publishers?: string[]
          publish_date?: string; number_of_pages?: number; physical_format?: string; edition_name?: string
          authors?: {key?: string}[]; languages?: {key?: string}[]; works?: {key?: string}[]; contributions?: {role?: string; name?: string}[]
        }
        if ([...(edition.isbn_13 || []), ...(edition.isbn_10 || [])].some((id) => normalizeIsbn(id) === isbn)) {
          result.title ||= edition.title
          result.publisher ||= edition.publishers?.join(', ')
          result.publicationDate ||= edition.publish_date
          result.pageCount ||= edition.number_of_pages
          result.language ||= edition.languages?.[0]?.key?.split('/').pop()
          result.openLibraryEditionKey = edition.key?.split('/').pop()
          result.openLibraryWorkKey = edition.works?.[0]?.key?.split('/').pop()
          result.editionStatement = edition.edition_name
          const format = edition.physical_format?.toLowerCase() || ''
          result.format ||= /paperback|softcover/.test(format) ? 'paperback' : /hardcover|hardback/.test(format) ? 'hardcover' : /ebook|e-book/.test(format) ? 'ebook' : /audio/.test(format) ? 'audiobook' : undefined
          const translators = edition.contributions?.filter((credit) => /translat/i.test(credit.role || '')).map((credit) => credit.name).filter((name): name is string => Boolean(name))
          if (translators?.length) result.translators = translators
          const authorKey = edition.authors?.[0]?.key
          if (!result.authors?.length && authorKey && /^\/authors\/OL[0-9]+A$/.test(authorKey)) {
            await (options.pace || paceOpenLibrary)()
            const authorResponse = await fetcher(`https://openlibrary.org${authorKey}.json`, {next: {revalidate: 86400}, signal: AbortSignal.timeout(5000)})
            if (authorResponse.ok) {
              const author = await authorResponse.json() as {name?: string}
              if (author.name) result.authors = [author.name]
            }
          }
        }
      }
    } catch { /* Keep verified Google metadata when Open Library is unavailable. */ }
  }
  async function available(url: string) {
    try {
      const response = await fetcher(url, {method: 'HEAD', next: {revalidate: 86400}, signal: AbortSignal.timeout(5000)})
      return response.ok && Boolean(response.headers.get('content-type')?.startsWith('image/'))
    } catch { return false }
  }
  const googleUrl = google && coverSrc(google)
  // Only probe known image hosts, never arbitrary URLs supplied by metadata.
  if (googleUrl && /^https:\/\/(books\.google\.com|books\.googleusercontent\.com)\//.test(googleUrl) && await available(googleUrl)) {
    result.cover = {url: googleUrl, source: 'google'}
  } else {
    const isbn = result.isbn13 || result.isbn10
    if (isbn) {
      await (options.pace || paceOpenLibrary)()
      const url = openLibraryCover(isbn)
      if (await available(url)) result.cover = {url, source: 'openLibrary'}
    }
  }
  result.needsCover = !result.cover
  return result
}
