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
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-3 px-5 py-4 sm:gap-x-3 sm:px-6 md:flex md:flex-wrap">
        <Link href="/" className="relative z-10 flex shrink-0 items-center gap-2 justify-self-start" aria-label="Everlogue">
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

        <nav className="relative z-10 flex min-w-0 items-center justify-center justify-self-center overflow-x-auto md:pointer-events-none md:absolute md:inset-0 md:flex-none">
          <div className="flex items-center justify-center gap-0.5 md:pointer-events-auto sm:gap-1">
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

        <div className="relative z-10 shrink-0 justify-self-end md:order-4">
          {auth}
        </div>
        <div className="col-span-3 min-w-0 md:order-3 md:ml-auto md:w-auto">
          <GlobalBookSearch variant="header" />
        </div>
      </div>
    </header>
  )
}
