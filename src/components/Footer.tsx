import Image from 'next/image'
import Link from 'next/link'

const LINKS = [
  {href: '/discover', label: 'Discover'},
  {href: '/genres', label: 'Genres'},
]

const READER_LINKS = [
  {href: '/my-books', label: 'My books'},
  {href: '/profile', label: 'My profile'},
  {href: '/settings', label: 'Settings'},
]

export default function Footer({signedIn}: {signedIn: boolean}) {
  const links = signedIn ? [...LINKS, ...READER_LINKS] : LINKS
  return (
    <footer className="mt-6 bg-[#f3efe6] text-ink min-[875px]:mt-8">
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-9 lg:py-12">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <p className="flex items-center gap-2 font-mono text-[0.62rem] font-medium tracking-[0.18em] text-[#ad4f3c] uppercase">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <path d="M3 3.2c1.8-.3 3.4.1 5 1.2v7.3c-1.6-1.1-3.2-1.5-5-1.2V3.2Z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M13 3.2c-1.8-.3-3.4.1-5 1.2v7.3c1.6-1.1 3.2-1.5 5-1.2V3.2Z" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              A reader&apos;s place
            </p>
            <Link href="/" className="mt-4 inline-flex items-center gap-3" aria-label="Everlogue">
              <Image
                src="/images/everlogue-logo.png"
                alt=""
                width={180}
                height={176}
                className="h-10 w-auto sm:h-12"
              />
              <span className="font-wordmark text-[2.4rem] leading-none tracking-normal sm:text-[3rem]">
                Everlogue
              </span>
            </Link>
            <p className="mt-4 font-accent text-[1.55rem] leading-none text-[#8d5a4d] italic sm:text-[1.85rem]">
              Read widely. Think freely.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="lg:pb-1">
            <p className="font-mono text-[0.62rem] font-medium tracking-[0.18em] text-muted uppercase">
              Find your next thread
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-10 gap-y-4">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 border-b border-ink/15 pb-2 text-[0.95rem] hover:border-ink"
                >
                  {item.label}
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
                    <path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M6 4h6v6" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-ink/15 pt-5 pr-44 font-mono text-[0.62rem] font-medium tracking-[0.16em] text-muted uppercase sm:flex-row sm:items-center sm:gap-10">
          <p>Everlogue — A reader&apos;s place</p>
          <p>A little room for big ideas</p>
        </div>
      </div>
    </footer>
  )
}
