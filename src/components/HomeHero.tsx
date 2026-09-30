import Image from 'next/image'
import Link from 'next/link'
import {HomeGreeting} from './HomeGreeting'

export function HomeHero({displayName}: {displayName?: string | null}) {
  return (
    <section className="grid items-stretch gap-4 px-5 py-2 pb-8 min-[875px]:grid-cols-2 min-[875px]:gap-x-12 min-[875px]:px-9 min-[875px]:pt-6 min-[875px]:pb-10 xl:gap-x-16">
      <div className="relative aspect-1024/387 overflow-hidden bg-[#1c2328] min-[875px]:hidden">
        <Image
          src="/images/everlogue-hero-banner.jpg"
          alt="Everlogue clothbound book with pressed flowers on a wooden table"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col justify-between gap-10">
        <div>
          <HomeGreeting displayName={displayName} />
          <h1 className="mt-4 font-display text-[clamp(2.75rem,14.5vw,6.55rem)] leading-[0.91] font-black tracking-[-0.13em]">
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
      <div className="relative hidden min-h-full overflow-hidden bg-[#1c2328] min-[875px]:block">
        <Image
          src="/images/everlogue-hero.jpg"
          alt="Everlogue clothbound book with pressed flowers on a wooden table"
          fill
          priority
          sizes="(min-width: 875px) 46vw, 0px"
          className="object-cover"
        />
      </div>
    </section>
  )
}
