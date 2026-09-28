import Link from 'next/link'
import {BookCover, type CoverSource} from './BookCover'
import {LibraryBookCover} from './LibraryBookCover'

export type BookCardData = {
  _id: string
  title: string
  slug?: string | null
  firstPublicationYear?: number | null
  authors?: string[] | null
  cover?: CoverSource | null
  description?: string | null
  myRating?: number | null
  ratingStats?: {average?: number | null; count?: number | null} | null
}

export function BookCard({
  book,
  large = false,
  fill = false,
  compact = false,
  resolveMissingCover = false,
}: {
  book: BookCardData
  large?: boolean
  fill?: boolean
  compact?: boolean
  resolveMissingCover?: boolean
}) {
  const href = book.slug ? `/books/${book.slug}` : '#'
  const width = fill
    ? 'w-full'
    : compact
      ? 'w-[104px] sm:w-[112px] shrink-0'
      : large
        ? 'w-[176px] sm:w-[196px] shrink-0'
        : 'w-[148px] sm:w-[168px] shrink-0'
  return (
    <Link href={href} className={`group block ${width}`}>
      {resolveMissingCover ? <LibraryBookCover bookId={book._id} cover={book.cover} title={book.title} className="aspect-[2/3] w-full" /> : <BookCover cover={book.cover} title={book.title} className="aspect-[2/3] w-full" />}
      <p className={`font-medium leading-snug tracking-[-0.01em] ${compact ? 'mt-2 line-clamp-2 text-sm' : 'mt-3'}`}>{book.title}</p>
      <p className={`mt-0.5 text-[var(--muted)] ${compact ? 'truncate text-xs' : 'text-sm'}`}>
        {book.authors?.filter(Boolean).join(', ') || 'Author unknown'}
      </p>
      {compact && book.firstPublicationYear ? (
        <p className="mt-0.5 text-xs text-[var(--muted)]">{book.firstPublicationYear}</p>
      ) : null}
      {typeof book.myRating === 'number' ? <p className="mt-1 text-xs text-[var(--sage)]" aria-label={`Your rating: ${book.myRating} out of 5 stars`}>Your rating: {book.myRating} ★</p> : null}
      {typeof book.ratingStats?.count === 'number' && book.ratingStats.count > 0 ? (
        <p className="mt-1 text-xs text-[var(--sage)]">
          {book.ratingStats.average} · {book.ratingStats.count} Read Evermore{' '}
          {book.ratingStats.count === 1 ? 'rating' : 'ratings'}
        </p>
      ) : null}
    </Link>
  )
}
