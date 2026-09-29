import {notFound} from 'next/navigation'
import {auth} from '@clerk/nextjs/server'
import {bookTitle, GOOGLE_VOLUME_ID} from '@/lib/google-books'
import {fetchGoogleVolume} from '@/lib/google-books-api'
import {SearchBookDetail, type SearchCatalogBook} from '@/components/SearchBookDetail'
import {EmptyState, ErrorState} from '@/components/States'
import {fetchCatalog} from '@/sanity/fetch'
import {BOOK_BY_GOOGLE_ID_QUERY} from '@/sanity/queries'
import {getOptionalReader} from '@/lib/reader'
import {getReaderBookState} from '@/lib/actions'
import {searchCatalogParams} from '@/lib/search-catalog'

export async function generateMetadata({params}: {params: Promise<{id: string}>}) {
  const {isAuthenticated} = await auth()
  if (!isAuthenticated) return {title: 'Book'}
  const {id} = await params
  if (!GOOGLE_VOLUME_ID.test(id)) return {title: 'Book'}
  try {
    const book = await fetchGoogleVolume(id)
    return {title: book ? bookTitle(book) : 'Book'}
  } catch {
    return {title: 'Book'}
  }
}

export default async function SearchBookPage({params}: {params: Promise<{id: string}>}) {
  const {isAuthenticated} = await auth()
  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to view this book"
        body="Google Books details are available after you sign in."
      />
    )
  }

  const {id} = await params
  if (!GOOGLE_VOLUME_ID.test(id)) notFound()

  let book
  try {
    book = await fetchGoogleVolume(id)
  } catch {
    return (
      <ErrorState
        title="This book couldn’t be loaded"
        body="Google Books did not return this record. Try your search again shortly."
      />
    )
  }
  if (!book) notFound()

  const catalog = await fetchCatalog<SearchCatalogBook | null>(BOOK_BY_GOOGLE_ID_QUERY, searchCatalogParams(book))

  const reader = await getOptionalReader().catch(() => null)
  const state = catalog?._id ? await getReaderBookState(catalog._id) : null

  return (
    <SearchBookDetail
      book={book}
      catalog={catalog}
      signedIn={Boolean(reader)}
      status={state?.status ?? null}
    />
  )
}
