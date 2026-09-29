import Link from 'next/link'
import {BookCover, type CoverSource} from './BookCover'
import {ClubMark} from './ClubMark'
import {clubInitials, firstSentence, splitClubTitle} from '@/lib/club-title'
import type {ClubImage} from '@/sanity/image'
import {collectionTypeLabel} from '@/lib/collection-type'

export type ClubShelfItem = {
  key: string
  href: string
  title: string
  authors: string
  selectionNumber?: number | null
  description?: string | null
  cover?: CoverSource | null
}

export function ClubCollectionView({
  title,
  description,
  curatorName,
  image,
  instagramUrl,
  collectionType,
  totalCount,
  items,
}: {
  title: string
  description?: string | null
  curatorName?: string | null
  image?: ClubImage
  instagramUrl?: string | null
  collectionType?: string | null
  totalCount: number
  items: ClubShelfItem[]
}) {
  const initials = clubInitials(curatorName, title)
  const {headline, italic} = splitClubTitle(title)
  const quote = firstSentence(description) || 'Books that stay with you.'
  const typeLabel = collectionTypeLabel(collectionType)

  return (
    <div>
      <div className="px-5 pt-5 sm:px-8 lg:px-9">
        <nav className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
          <Link href="/discover" className="inline-flex items-center gap-2 text-ink hover:text-muted">
            <span aria-hidden="true">←</span>
            Book clubs
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{title}</span>
        </nav>
      </div>

      <section className="px-5 pt-4 pb-10 sm:px-8 lg:px-9 lg:pt-4 lg:pb-14">
        <div className="mt-8 grid items-stretch gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,28rem)] lg:gap-x-12 xl:gap-x-16">
          <div className="flex min-w-0 flex-col">
            <p className="flex items-center gap-3 text-sm text-muted">
              <ClubMark image={image} initials={initials} title={title} />
              {curatorName ? `Curated by ${curatorName}` : title}
            </p>

            <h1 className="mt-6 font-display text-[clamp(3rem,8vw,6.6rem)] leading-[0.84] font-black tracking-[-0.12em]">
              <span className="block">{headline}</span>
              {italic ? <span className="mt-1 block font-accent text-[0.72em] leading-[0.9] font-normal tracking-[-0.04em] italic">{italic}</span> : null}
            </h1>

            {description ? (
              <p className="mt-8 max-w-md text-[1.02rem] leading-[1.65] text-muted">{description}</p>
            ) : null}
 
          </div>

          <aside className="relative flex min-h-80 flex-col justify-between overflow-hidden bg-[#d7e4d8] px-8 py-8 text-ink xl:min-h-96">
            <span className="pointer-events-none absolute -top-16 -right-12 size-56 rounded-full border border-ink/10" aria-hidden="true" />
            <span className="pointer-events-none absolute top-6 -right-6 size-36 rounded-full border border-ink/10" aria-hidden="true" />
            <div className="relative z-1 flex items-start justify-between gap-4">
              <p className="font-mono text-[0.62rem] font-medium tracking-[0.16em] uppercase">A note from the club</p>
              <ClubMark image={image} initials={initials} title={title} className="size-9 border-ink/20!" />
            </div>
            <p className="relative z-1 max-w-sm font-accent text-[clamp(1.85rem,3vw,2.7rem)] leading-[1.08] italic">
              &ldquo;{quote}&rdquo;
            </p>
            <div className="relative z-1 flex items-end justify-between gap-4 border-t border-ink/15 pt-5 font-mono text-[0.62rem] font-medium tracking-[0.16em] uppercase">
              <p>The reason to read together</p>
              <p className="text-ink/55">E / 01</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-(--line) px-5 pt-10 pb-4 sm:px-8 lg:px-9">
        <p className="font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">
          The reading list / {totalCount} selections
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.92] font-black tracking-[-0.08em]">
            On this shelf.
          </h2>
          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 border bg-paper px-3.5 text-[0.62rem] font-medium tracking-[0.14em] uppercase border-[#d6d6d6]!"
            >
              <span aria-hidden="true">+</span>
              Follow this club
            </a>
          ) : null}
        </div>
      </section>

      <ol className="px-5 sm:px-8 lg:px-9">
        {items.map((item, index) => (
          <li key={item.key} className="border-t border-(--line)">
            <Link href={item.href} className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-4 py-7 sm:gap-6 lg:gap-8">
              <span className="font-accent text-[1.65rem] leading-none text-muted italic sm:text-[1.85rem]">
                {String(item.selectionNumber || items.length - index).padStart(2, '0')}
              </span>
              <BookCover cover={item.cover} title={item.title} className="aspect-2/3 w-16 sm:w-22" sizes="88px" imageWidth={176} />
              <div className="min-w-0 lg:col-auto">
                <p className="mt-1.5 font-display text-[clamp(1.35rem,3vw,2.35rem)] leading-[0.95] font-black tracking-[-0.07em]">
                  {item.title}
                </p>
                <p className="mt-1.5 text-sm text-black/60 font-semibold">{item.authors}</p>
                {item.description ? (
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted line-clamp-2">{item.description}</p>
                ) : null}
              </div>
              <span className="grid size-9 shrink-0 place-items-center border border-[#d6d6d6]! sm:size-10" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                  <path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M6 4h6v6" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mx-5 flex flex-wrap items-end justify-between gap-3 border-t border-(--line) py-8 font-accent text-[1.15rem] text-muted italic sm:mx-8 lg:mx-9">
        <p>A good pick is better when it&apos;s shared.</p>
        <p className="font-mono text-[11px] font-medium tracking-[0.16em] not-italic uppercase">
          {initials} / End of featured shelf
        </p>
      </div>

      <div className="mx-5 flex flex-wrap items-end justify-between gap-4 border-t border-(--line) py-10 sm:mx-8 lg:mx-9">
        <div>
          <p className="font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">Keep looking</p>
          <p className="mt-2 max-w-xl font-display text-[clamp(1.6rem,4vw,2.4rem)] leading-[0.95] font-black tracking-[-0.07em]">
            Another point of view is only a shelf away.
          </p>
        </div>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 border-b pb-0.5 font-mono text-[0.68rem] font-medium tracking-[0.16em] uppercase border-b-ink!"
        >
          Explore all clubs
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}
