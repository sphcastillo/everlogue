import Link from 'next/link'
import {BookCover, type CoverSource} from './BookCover'
import {HomeGreeting} from './HomeGreeting'

export type HeroBook = {
  title: string
  href: string
  authors?: string[] | null
  cover?: CoverSource | null
  collectionTitle?: string | null
}

export function HomeHero({
  displayName,
  featured,
}: {
  displayName?: string | null
  featured?: HeroBook | null
}) {
  const authors = featured?.authors?.filter(Boolean).join(', ')

  return (
    <section className="grid items-stretch gap-10 px-5 py-2 pb-8 lg:grid-cols-2 lg:gap-x-12 lg:px-9 lg:pt-6 lg:pb-10 xl:gap-x-16">
      <div className="flex flex-col justify-between gap-10">
        <div>
          <HomeGreeting displayName={displayName} />
          <h1 className="mt-4 font-display text-[clamp(2.7rem,8vw,6.55rem)] leading-[0.91] font-black tracking-[-0.13em]">
            <span className="block">Find the book</span>
            <span className="block">you can&apos;t stop</span>
            <span className="block w-fit border-b-[0.045em] border-ink pb-[0.02em] border-b-ink!">thinking about.</span>
          </h1>
          <p className="mt-6 max-w-88 text-[1.02rem] leading-[1.6] font-normal text-muted">
            Not the next book everyone&apos;s reading. The one that feels like it found you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/discover"
            className="inline-flex min-h-12 items-center justify-center gap-4 rounded-xs border border-ink bg-ink px-5.5 font-sans text-[0.68rem] font-medium tracking-[0.16em] text-white uppercase hover:bg-black [&_svg]:size-3.5 [&_svg]:shrink-0"
          >
            Find my next read
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 12h5V7" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </Link>
          <Link
            href="/my-books"
            className="inline-flex min-h-12 items-center justify-center gap-4 rounded-xs border bg-paper px-5.5 font-sans text-[0.68rem] font-medium tracking-[0.16em] text-ink uppercase border-ink! [&_svg]:size-3.5 [&_svg]:shrink-0"
          >
            Go to my books
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4l5 4-5 4" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </Link>
        </div>
      </div>
      {featured ? (
        <Link
          href={featured.href}
          className="relative block h-full min-h-80 w-full self-stretch overflow-hidden bg-ink text-white lg:min-h-0"
        >
          <BookCover
            cover={featured.cover}
            title={featured.title}
            priority
            sizes="(max-width: 1024px) 92vw, 42vw"
            className="absolute inset-0 h-full w-full rounded-none shadow-none"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/45 via-black/10 to-black/80" />
          <div className="absolute inset-x-0 top-0 z-1 flex h-7 items-center justify-between gap-4 px-6 font-mono text-[0.68rem] font-medium tracking-[0.16em] uppercase">
            <span className="flex items-center gap-2">
              <span className="grid size-3.5 place-items-center bg-white text-[8px] text-ink">+</span>
              The Everlogue match
            </span>
            <span className="text-white/80">{featured.collectionTitle || 'Current pick'}</span>
          </div>
          <div className="absolute inset-x-6 bottom-6 z-1 max-w-md">
            <p className="font-mono text-[0.68rem] font-medium tracking-[0.16em] text-white/75 uppercase">
              Picked for your shelf
            </p>
            <p className="mt-3 font-display text-[clamp(2.1rem,4vw,3.4rem)] leading-[1.02] font-bold tracking-[-0.04em]">
              {featured.title}
            </p>
            {authors ? <p className="mt-2 font-accent text-[1.05rem] text-white/85 italic">{authors}</p> : null}
          </div>
        </Link>
      ) : null}
    </section>
  )
}
