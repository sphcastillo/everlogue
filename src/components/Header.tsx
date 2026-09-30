'use client'
import Image from 'next/image'
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
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 px-5 py-4 sm:gap-x-3 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,18rem)_auto] lg:gap-x-4">
        <Link href="/" className="col-start-1 row-start-1 flex shrink-0 items-center gap-2" aria-label="Everlogue">
          <Image
            src="/images/everlogue-logo.png"
            alt=""
            width={180}
            height={176}
            className="h-8 w-auto sm:h-9"
            priority
          />
          <span className="hidden font-wordmark text-[1.35rem] leading-none tracking-normal min-[540px]:inline min-[540px]:text-[1.48rem]">
            Everlogue
          </span>
        </Link>

        <nav className="col-start-2 row-start-1 min-w-0 overflow-x-auto">
          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative shrink-0 px-2 py-2 text-[0.68rem] font-medium tracking-[0.14em] uppercase sm:px-3 sm:text-[0.72rem] sm:tracking-[0.16em] ${
                    active ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                  {active ? <span className="absolute inset-x-2 bottom-0.5 h-px bg-ink sm:inset-x-3" /> : null}
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="col-span-3 row-start-2 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1">
          <GlobalBookSearch variant="header" />
        </div>
        <div className="col-start-3 row-start-1 shrink-0 justify-self-end lg:col-start-4">
          {auth}
        </div>
      </div>
    </header>
  )
}
