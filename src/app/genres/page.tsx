import type {Metadata} from 'next'
import {EmptyState} from '@/components/States'
import {GenresDirectory, type DirectoryGenre} from '@/components/GenresDirectory'
import {fetchCatalog} from '@/sanity/fetch'
import {GENRES_QUERY} from '@/sanity/queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Genres',
  description: 'Browse every genre in the Everlogue book archive.',
}

export default async function GenresPage() {
  const genres = await fetchCatalog<DirectoryGenre[]>(GENRES_QUERY)
  const ordered = [...genres].sort((left, right) => {
    const leftGroup = left.parent?.title || left.title
    const rightGroup = right.parent?.title || right.title
    return leftGroup.localeCompare(rightGroup) || left.title.localeCompare(right.title)
  })

  return (
    <div className="px-5 pb-20 sm:px-8 lg:px-9">
      <header className="border-b border-(--line) pt-12 pb-12 sm:pt-16 sm:pb-16">
        <h1 className="font-display text-[clamp(4.4rem,13.3vw,9.5rem)] leading-[0.78] font-black tracking-[-0.11em]">
          <span className="block">A shelf for</span>
          <span className="block">
            every{' '}
            <span className="font-accent font-normal tracking-[-0.07em] text-[#ad4f3c] italic">
              curiosity.
            </span>
          </span>
        </h1>
        <p className="mt-10 max-w-2xl text-[1.05rem] leading-7 text-muted">
          Start with what you love, or follow a thread somewhere new. Pick a few genres and we’ll lay out a small
          stack to explore.
        </p>
      </header>

      {ordered.length ? (
        <GenresDirectory genres={ordered} />
      ) : (
        <div className="mt-10">
          <EmptyState
            title="No genres yet"
            body="Genres created in Sanity will appear here automatically."
          />
        </div>
      )}
    </div>
  )
}
