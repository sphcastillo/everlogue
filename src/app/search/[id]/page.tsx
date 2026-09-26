import {notFound, redirect} from 'next/navigation'
import {auth} from '@clerk/nextjs/server'
import {bookTitle, GOOGLE_VOLUME_ID} from '@/lib/google-books'
import {fetchGoogleVolume} from '@/lib/google-books-api'
import {SearchBookDetail} from '@/components/SearchBookDetail'
import {EmptyState, ErrorState} from '@/components/States'
import {fetchCatalog} from '@/sanity/fetch'

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

  const catalogBook = await fetchCatalog<{slug: string} | null>(
    `*[_type == "book" && (googleBooksId == $id || _id in *[_type == "edition" && googleBooksId == $id].book._ref)][0]{"slug": coalesce(slug.current, _id)}`,
    {id},
  )
  if (catalogBook) redirect(`/books/${catalogBook.slug}`)

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
  return <SearchBookDetail book={book} />
}
