import Image from 'next/image'
import Link from 'next/link'

const SHELVES = [
  {eyebrow: 'Already loved', label: 'Read'},
  {eyebrow: 'On your nightstand', label: 'Currently reading'},
  {eyebrow: 'For another day', label: 'Want to read'},
]

export default function BringYourGoodReads() {
  return (
    <section className="border-t border-(--line) px-5 py-10 sm:px-8 lg:px-9 lg:py-16">
      <style>{`
        @media (min-width: 768px) {
          .bring-goodreads-columns {
            display: flex;
            align-items: center;
          }
          .bring-goodreads-image {
            order: 2;
            flex: calc(0.5 * (100vw - 512px) / 256px) 1 0%;
            min-width: 0;
          }
          .bring-goodreads-copy {
            order: 1;
            flex: 1 1 0%;
            min-width: 0;
          }
        }
        @media (min-width: 1024px) {
          .bring-goodreads-image {
            flex: 1 1 0%;
          }
        }
      `}</style>
      <div className="bring-goodreads-columns grid items-center gap-8 md:gap-10 lg:gap-14">
        <div className="bring-goodreads-image">
          <div className="relative aspect-4/5 overflow-hidden bg-[#2a211c] sm:aspect-5/4">
            <Image
              src="/images/bring-goodreads-here.png"
              alt="An open handwritten journal and a linen notebook resting on a wooden table"
              fill
              sizes="(min-width: 1024px) 46vw, (min-width: 48rem) 38vw, 100vw"
              className="object-cover"
            />
            <p className="absolute top-4 left-4 inline-flex items-center gap-2 bg-[#f7f3ec] px-2.5 py-1.5 font-mono text-[10px] font-medium tracking-[0.14em] text-ink uppercase">
              <span className="grid size-5 place-items-center rounded-full bg-[#e6dfd4] font-accent text-[0.8rem] lowercase italic" aria-hidden="true">
                g
              </span>
              Goodreads → Everlogue
            </p>
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/40 to-transparent px-3 pt-20 pb-3 sm:px-4 sm:pb-4">
              <p className="font-mono text-[9px] font-medium tracking-[0.16em] text-white/85 uppercase sm:text-[10px]">
                Three shelves. One familiar feeling.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
                {SHELVES.map((shelf) => (
                  <div key={shelf.label} className="bg-[#f7f3ec] px-2 py-2 text-ink sm:px-2.5 sm:py-2.5">
                    <p className="text-[8px] leading-tight text-muted sm:text-[9px]">{shelf.eyebrow}</p>
                    <div className="mt-2 flex items-end justify-between gap-1">
                      <p className="text-[0.68rem] leading-tight font-medium sm:text-[0.78rem]">{shelf.label}</p>
                      <span className="text-sm leading-none text-muted" aria-hidden="true">›</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-mono text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
              One little import. A bookshelf that feels like home.
            </p>
            <p className="font-accent text-[0.95rem] text-[#ad4f3c] italic">Every page, accounted for.</p>
          </div>
        </div>

        <div className="bring-goodreads-copy">
          <p className="flex items-center gap-2.5 font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
            <span className="size-2 bg-[#ad4f3c]" aria-hidden="true" />
            Your reading life, made portable
          </p>
          <h2 className="mt-5 max-w-xl font-display text-[clamp(3.2rem,7vw,5.4rem)] leading-[0.84] font-black tracking-[-0.07em]">
            <span className="block">The stories</span>
            <span className="block">you&apos;ve loved</span>
            <span className="mt-1 block font-accent text-[0.62em] leading-none font-normal tracking-[-0.04em] text-[#ad4f3c] italic">
              come with you.
            </span>
          </h2>
          <p className="mt-6 max-w-md text-[1.02rem] leading-7 text-ink/75">
            Already have a bookshelf on Goodreads? Bring your titles and reading history along. Your Everlogue shelf can feel like yours from the very first page.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/settings/library/import-export"
              className="inline-flex min-h-12 items-center gap-4 bg-ink px-5 font-mono text-[0.68rem] font-medium tracking-[0.14em] text-white uppercase"
            >
              Bring my Goodreads library
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6.5 4H12v5.5" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </Link>
            <Link href="/settings/library/import-export" className="text-sm text-muted hover:text-ink">
              Have a Goodreads CSV ready?
            </Link>
          </div>
          <p className="mt-6 flex items-center gap-2.5 text-sm text-muted">
            <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
              <path d="m5.2 8.1 1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Your shelves stay yours. Start with a list you already love.
          </p>
        </div>
      </div>
    </section>
  )
}
