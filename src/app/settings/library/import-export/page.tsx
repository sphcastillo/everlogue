import Link from 'next/link'
import {auth} from '@clerk/nextjs/server'
import {GoodreadsImport} from '@/components/GoodreadsImport'

export default async function ImportExportPage() {
  await auth.protect()
  return (
    <div className="px-5 pb-20 sm:px-8 lg:px-9">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 pt-5 font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase"
      >
        <Link href="/settings" className="inline-flex items-center gap-2 text-ink hover:text-muted">
          <span aria-hidden="true">←</span>
          Settings
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">Import &amp; Export</span>
      </nav>

      <header className="pt-8 pb-8">
        <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Library</p>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,4.6rem)] leading-[0.88] font-black tracking-[-0.07em]">
          Import &amp; Export.
        </h1>
        <p className="mt-4 max-w-md text-[1.02rem] leading-7 text-muted">
          Your reading story belongs with you. Bring your books into Everlogue, or take a copy of your shelves with you.
        </p>
      </header>

      <GoodreadsImport />

      <section className="mt-2 border-t border-(--line) pt-8">
        <h2 className="font-display text-[1.35rem] leading-none font-black tracking-[-0.04em]">Export your library</h2>
        <p className="mt-3 max-w-lg text-[0.95rem] leading-relaxed text-muted">
          Download your Read, Want To Read, and Currently Reading shelves, with available reading dates, as a CSV.
        </p>
        <a
          href="/api/library/export"
          download
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-4 border border-ink bg-ink px-5.5 font-sans text-[0.68rem] font-medium tracking-[0.16em] text-white uppercase hover:bg-black"
        >
          Download library CSV
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
            <path d="M8 3v8" stroke="currentColor" strokeWidth="1.4" />
            <path d="M4.5 8.5 8 12l3.5-3.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
      </section>
    </div>
  )
}
