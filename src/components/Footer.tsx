import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="px-5 pt-16 pb-8 min-[875px]:px-9 min-[875px]:pt-20 min-[875px]:pb-10">
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
      <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-(--line) pt-5 text-[0.62rem] font-medium tracking-[0.16em] text-muted uppercase">
        <p>Read widely. Think freely.</p>
        <p>Everlogue — a reader&apos;s place</p>
      </div>
    </footer>
  )
}
