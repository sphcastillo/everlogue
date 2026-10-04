import Image from 'next/image'
import {GlobalBookSearch} from './GlobalBookSearch'

function CatalogGrowthImage({
  className,
  sizes,
}: {
  className: string
  sizes: string
}) {
  return (
    <div className={className}>
      <Image
        src="/images/everlogue-catalog-growth.jpg"
        alt="Open journal with a pressed botanical print, stacked clothbound books, and dried flowers on a dark table"
        fill
        sizes={sizes}
        className="object-cover"
      />
      <p className="absolute top-5 right-5 border border-white/80 px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.18em] text-white uppercase">
        Reader-submitted
      </p>
      <p className="absolute bottom-5 left-5 font-mono text-[10px] font-medium tracking-[0.18em] text-white uppercase">
        There&apos;s always room for one more
      </p>
    </div>
  )
}

export default function HomeCatalogGrowth() {
  return (
    <section className="grid items-stretch gap-4 px-5 pb-8 min-[875px]:grid-cols-2 min-[875px]:gap-x-12 min-[875px]:px-9 min-[875px]:pt-6 min-[875px]:pb-10 xl:gap-x-16">
      <CatalogGrowthImage
        className="relative aspect-1024/387 overflow-hidden bg-[#1c1714] min-[875px]:hidden"
        sizes="100vw"
      />
      <CatalogGrowthImage
        className="relative hidden min-h-full overflow-hidden bg-[#1c1714] min-[875px]:order-1 min-[875px]:block"
        sizes="(min-width: 875px) 46vw, 0px"
      />
      <div className="flex flex-col justify-between gap-10 min-[875px]:order-2">
        <div>
          <p className="flex items-center gap-2.5 font-mono text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
            <Image src="/images/everlogue-logo.png" alt="" width={180} height={176} className="size-4" />
            A shelf that keeps growing
          </p>
          <h2 className="mt-6 max-w-xl font-display text-[clamp(2.4rem,12vw,4.35rem)] leading-[0.88] font-black -tracking-widest">
            Help Us Grow
            <span className="block">Our Catalog</span>
          </h2>
          <p className="mt-5 max-w-md text-[1.02rem] leading-[1.6] text-ink">
            Search for a book and add it to your shelf. We&apos;ll review and give it a home.
          </p>
        </div>
        <div className="max-w-lg">
          <GlobalBookSearch variant="catalog" />
          <p className="mt-3 text-sm text-muted">Search first. If it&apos;s not here, tell us the title and author.</p>
        </div>
      </div>
    </section>
  )
}
