import {getMyBooks} from '@/lib/actions'
import {auth} from '@clerk/nextjs/server'
import {EmptyState} from '@/components/States'
import {MyBooksLibrary, type LibraryShelf} from '@/components/MyBooksLibrary'

export const dynamic = 'force-dynamic'

export default async function MyBooksPage() {
  await auth.protect()
  const data = (await getMyBooks().catch(() => null)) as {shelves?: LibraryShelf[]} | null

  if (!data) {
    return (
      <div className="px-5 py-16 sm:px-8 lg:px-9">
        <p className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
          A record of your reading life
        </p>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,4.6rem)] leading-[0.88] font-black tracking-[-0.07em]">
          My books<span className="text-[#b8b8b8]" aria-hidden="true">.</span>
        </h1>
        <div className="mt-10">
          <EmptyState
            title="Sign in to open your shelves"
            body="My Books is private. Sign in to keep ratings and shelves with your account."
          />
        </div>
      </div>
    )
  }

  return <MyBooksLibrary shelves={data.shelves || []} />
}
