import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative mt-6 border-t border-ink/18 px-5 pt-14 pb-8 shadow-[inset_0_20px_32px_-28px_color-mix(in_srgb,#3a4570_20%,transparent)] min-[875px]:mt-8 min-[875px]:px-9 min-[875px]:pt-16 min-[875px]:pb-10">
      <span className="pointer-events-none absolute inset-x-0 top-1.25 h-px bg-(--line)" aria-hidden="true" />
      <div className="grid items-end gap-10 min-[875px]:grid-cols-2 min-[875px]:gap-x-12 xl:gap-x-16">
        <div>
          <p className="text-[0.62rem] font-medium tracking-[0.2em] text-muted uppercase">
            A little room to wander
          </p>
          <h2 className="mt-3 max-w-xl font-display text-[clamp(2rem,6vw,3.5rem)] leading-[0.92] font-black tracking-[-0.06em]">
            Reading is a good
            <span className="block">way to get lost.</span>
          </h2>
        </div>
        <div className="min-[875px]:pb-1">
          <div className="border-t border-(--line) pt-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
              <p className="max-w-md text-[0.92rem] leading-relaxed text-muted">
                Your shelves keep the receipts. Your people leave the breadcrumbs. The next book is somewhere in between.
              </p>
              <Link
                href="/my-books"
                className="inline-flex shrink-0 items-center gap-4 self-start text-[0.68rem] font-medium tracking-[0.16em] text-ink uppercase xl:self-auto"
              >
                See what you&apos;ve been reading
                <span className="grid size-10 place-items-center border border-ink" aria-hidden="true">
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                    <path d="M3 8h9" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 4l5 4-5 4" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-16 border-t border-(--line) pt-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-ink" aria-label="Everlogue">
          <Image src="/images/everlogue-logo.png" alt="" width={180} height={176} className="h-5 w-auto" />
          <span className="font-wordmark text-[1.2rem] leading-none tracking-normal">Everlogue</span>
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[0.62rem] font-medium tracking-[0.16em] text-muted uppercase">
          <p>Read widely. Think freely.</p>
          <p>A reader&apos;s place</p>
        </div>
      </div>
    </footer>
  )
}
