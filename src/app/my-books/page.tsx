import {getMyBooks} from '@/lib/actions'
import {type BookCardData} from '@/components/BookCard'
import {EmptyState} from '@/components/States'
import {ShelfCarousel} from '@/components/ShelfCarousel'

export const dynamic = 'force-dynamic'

export default async function MyBooksPage() {
  const data = (await getMyBooks().catch(() => null)) as {
    shelves?: {
      _id: string
      name: string
      kind: string
      entries?: {book?: BookCardData | null}[]
    }[]
  } | null

  if (!data) {
    return (
      <EmptyState
        title="Sign in to open your shelves"
        body="My Books is private. Clerk authentication and a server Sanity write token are required to persist ratings and shelves."
      />
    )
  }

  return (
    <div className="space-y-6">
      {(data.shelves || []).map((shelf) => {
        const books = (shelf.entries || []).flatMap((entry) => (entry.book ? [entry.book] : []))
        return (
          <ShelfCarousel
            key={shelf._id}
            id={shelf._id}
            title={shelf.kind === 'finished' ? 'Read' : shelf.name}
            books={books}
          />
        )
      })}
    </div>
  )
}
