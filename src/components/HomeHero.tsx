import Image from 'next/image'
import Link from 'next/link'
import {HomeGreeting} from './HomeGreeting'

export function HomeHero({
  displayName,
  signedIn = false,
}: {
  displayName?: string | null
  signedIn?: boolean
}) {
  return (
    <section className="relative grid items-stretch px-0 py-0 min-[875px]:grid-cols-2 min-[875px]:items-start min-[875px]:gap-x-8 min-[875px]:px-6 min-[875px]:pt-6 min-[875px]:pb-10 xl:gap-x-16">
      <div className="absolute inset-0 overflow-hidden bg-[#2a1f18] min-[875px]:hidden" aria-hidden="true">
        <Image
          src="/images/everlogueLONGBanner.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/45 via-black/35 to-black/55" />
      </div>
      <div className="relative z-10 flex flex-col justify-between gap-10 text-white min-[875px]:aspect-square min-[875px]:w-full min-[875px]:gap-5 min-[875px]:self-start min-[875px]:text-ink min-[875px]:@container">
        <div>
          <HomeGreeting displayName={displayName} />
          <h1 className="mt-4 font-display text-[clamp(2.75rem,14.5vw,6.55rem)] leading-[0.91] font-black tracking-[-0.13em] min-[875px]:mt-3 min-[875px]:text-[clamp(5rem,12.5cqi,4.7rem)] lg:text-[clamp(6rem,12.5cqi,4.7rem)]">
            <span className="block">Find the book</span>
            <span className="block">you can&apos;t stop</span>
            <span className="block w-fit border-b-[0.045em] border-current pb-[0.02em]">thinking about.</span>
          </h1>
          <p className="mt-6 max-w-88 text-[1.02rem] leading-[1.6] font-normal text-white/80 min-[875px]:mt-4 min-[875px]:text-muted lg:text-[1.1rem]">
            Not the next book everyone&apos;s reading. The one that feels like it found you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/discover"
            className="inline-flex min-h-12 items-center justify-center gap-4 rounded-xs border border-white bg-ink px-5.5 font-sans text-[0.68rem] font-medium tracking-[0.16em] text-white uppercase hover:bg-black min-[875px]:border-ink [&_svg]:size-3.5 [&_svg]:shrink-0"
          >
            Find my next read
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 12h5V7" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </Link>
          {signedIn ? (
            <Link
              href="/my-books"
              className="inline-flex min-h-12 items-center justify-center gap-4 rounded-xs border border-white bg-paper px-5.5 font-sans text-[0.68rem] font-medium tracking-[0.16em] text-ink uppercase min-[875px]:border-ink! [&_svg]:size-3.5 [&_svg]:shrink-0"
            >
              Go to my books
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h9" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 4l5 4-5 4" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-[#1c2328] min-[875px]:block min-[875px]:aspect-square min-[875px]:w-full min-[875px]:self-start">
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
