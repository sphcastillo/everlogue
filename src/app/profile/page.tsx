import Image from 'next/image'
import Link from 'next/link'
import {auth} from '@clerk/nextjs/server'
import {BookCover} from '@/components/BookCover'
import {ReviewCopy, ReviewSpoiler} from '@/components/ReviewSpoiler'
import {formatRating, StarDisplay} from '@/components/StarDisplay'
import {getOptionalReader} from '@/lib/reader'
import {getReaderProfileShowcase} from '@/lib/actions'

export const dynamic = 'force-dynamic'

function pad(count: number) {
  return String(count).padStart(2, '0')
}

export default async function ProfilePage() {
  await auth.protect()
  const reader = await getOptionalReader().catch(() => null)
  const showcase = await getReaderProfileShowcase().catch(() => ({ratings: [], reviews: []}))
  const name = reader?.displayName || 'Reader'
  const initials = name.trim().charAt(0) || 'R'
  const ratings = showcase.ratings
  const reviews = showcase.reviews

  return (
    <div className="px-5 pb-20 sm:px-8 lg:px-9">
      <header className="flex flex-wrap items-end justify-between gap-8 pt-8 pb-10">
        <div className="flex min-w-0 items-center gap-4">
          <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-ink">
            {reader?.avatarSrc ? (
              <Image
                src={reader.avatarSrc}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
                unoptimized={/^https?:/i.test(reader.avatarSrc)}
              />
            ) : (
              <span className="grid size-full place-items-center text-lg font-medium tracking-wide text-white uppercase">
                {initials}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Your profile</p>
            <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.88] font-black tracking-[-0.07em]">
              {name}.
            </h1>
            <p className="mt-3 max-w-md text-[1.02rem] leading-7 text-muted">
              Ratings and reviews you leave live here, alongside the books they belong to.
            </p>
          </div>
        </div>
        <dl className="flex gap-8 sm:gap-12">
          <div className="text-right">
            <dt className="sr-only">Ratings</dt>
            <dd className="font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(ratings.length)}</dd>
            <p className="mt-2 font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">Ratings</p>
          </div>
          <div className="text-right">
            <dt className="sr-only">Reviews</dt>
            <dd className="font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(reviews.length)}</dd>
            <p className="mt-2 font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">Reviews</p>
          </div>
        </dl>
      </header>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-(--line) pb-3">
          <h2 className="flex items-baseline gap-3 font-display text-[1.45rem] leading-none font-black tracking-[-0.04em]">
            Ratings
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{pad(ratings.length)}</span>
          </h2>
          <p className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">Half stars count</p>
        </div>
        {ratings.length ? (
          <ul className="divide-y divide-(--line)">
            {ratings.map((row) => {
              const book = row.book!
              const href = book.slug ? `/books/${book.slug}` : '#'
              const authors = book.authors?.filter(Boolean).join(', ') || 'Author unknown'
              return (
                <li key={`${book._id}-${row.value}`}>
                  <Link href={href} className="group flex items-center gap-4 py-4">
                    <BookCover
                      cover={book.cover}
                      title={book.title}
                      className="aspect-2/3 w-12 shrink-0"
                      imageWidth={160}
                      sizes="48px"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{book.title}</span>
                      <span className="mt-0.5 block truncate text-sm text-muted">{authors}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StarDisplay value={row.value} id={`rating-${book._id}`} size="sm" />
                      <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
                        {formatRating(row.value)} / 5
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted">
            No ratings yet. Open a book you&apos;ve read and leave stars.{' '}
            <Link href="/my-books" className="text-ink underline-offset-4 hover:underline">My books</Link>
          </p>
        )}
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-(--line) pb-3">
          <h2 className="flex items-baseline gap-3 font-display text-[1.45rem] leading-none font-black tracking-[-0.04em]">
            Reviews
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{pad(reviews.length)}</span>
          </h2>
          <p className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">Yours, kept or shared</p>
        </div>
        {reviews.length ? (
          <ul className="divide-y divide-(--line)">
            {reviews.map((row) => {
              const book = row.book!
              const href = book.slug ? `/books/${book.slug}` : '#'
              const authors = book.authors?.filter(Boolean).join(', ') || 'Author unknown'
              return (
                <li key={`${book._id}-review`} className="grid gap-4 py-6 min-[540px]:grid-cols-[auto_minmax(0,1fr)] min-[540px]:gap-6">
                  <Link href={href} className="shrink-0">
                    <BookCover
                      cover={book.cover}
                      title={book.title}
                      className="aspect-2/3 w-16 sm:w-20"
                      imageWidth={240}
                      sizes="80px"
                    />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={href} className="font-medium hover:underline hover:underline-offset-4">
                        {book.title}
                      </Link>
                      <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted uppercase">
                        {row.visibility === 'public' ? 'Public' : 'Only you'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{authors}</p>
                    {typeof row.rating === 'number' ? (
                      <div className="mt-3">
                        <StarDisplay value={row.rating} id={`review-${book._id}`} size="sm" />
                      </div>
                    ) : null}
                    <div className="mt-4">
                      {row.hasSpoilers ? (
                        <ReviewSpoiler title={row.title}>{row.body}</ReviewSpoiler>
                      ) : (
                        <ReviewCopy title={row.title} body={row.body} />
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted">
            No reviews yet. Mark a book as Read, then write what stayed with you.
          </p>
        )}
      </section>
    </div>
  )
}
