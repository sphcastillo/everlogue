'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {GlobalBookSearch} from './GlobalBookSearch'

const NAV = [
    { href: '/', label: 'Home' },
    { href: '/discover', label: 'Discover' },
    { href: '/my-books', label: 'My Books' },
]

export default function Header({auth}: {auth: React.ReactNode; signedIn: boolean}) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-(--line) bg-paper">
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-ink text-white" aria-hidden="true">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
              <path d="M3.2 2.6h5.2c1.7 0 2.8 1 2.8 2.5v8.3H6C4.3 13.4 3.2 12.4 3.2 10.9V2.6Z" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6.4 2.6v10.8" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          <span className="truncate font-display text-[1.05rem] leading-none font-black tracking-tight">Everlogue</span>
        </Link>

        <nav className="order-3 flex w-full items-center justify-center overflow-x-auto md:pointer-events-none md:absolute md:inset-0 md:order-0 md:flex md:items-center">
          <div className="flex items-center justify-center gap-1 md:pointer-events-auto">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative shrink-0 px-3 py-2 text-[0.72rem] font-medium tracking-[0.16em] uppercase ${
                    active ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                  {active ? <span className="absolute inset-x-3 bottom-0.5 h-px bg-ink" /> : null}
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-4">
          <GlobalBookSearch variant="header" />
          {/* <button
            type="button"
            className="hidden items-center gap-1.5 text-[0.7rem] font-medium tracking-[0.14em] text-ink uppercase sm:inline-flex"
            onClick={() => document.getElementById('header-book-search')?.focus()}
          >
            Add a book
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
              <path d="M3 8h9" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4l5 4-5 4" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button> */}
          {auth}
        </div>
      </div>
    </header>
  )
}
