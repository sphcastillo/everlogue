import Link from 'next/link'
import {fetchCatalog} from '@/sanity/fetch'
import {TASTE_TRAVELS_QUERY} from '@/sanity/queries'

type TasteItem = {
  _id: string
  _createdAt?: string | null
  body?: string | null
  name?: string | null
  spaceColor?: string | null
  bookTitle?: string | null
  bookSlug?: string | null
  clubName?: string | null
  clubSlug?: string | null
  verb: string
  href: string
  linkLabel?: string | null
}

const AVATAR: Record<string, string> = {
  cloud: 'bg-(--palette-cloud) text-ink',
  blush: 'bg-(--palette-blush) text-ink',
  violet: 'bg-(--palette-violet) text-white',
  clay: 'bg-(--palette-clay) text-white',
  apricot: 'bg-(--palette-apricot) text-ink',
  butter: 'bg-(--palette-butter) text-ink',
  mint: 'bg-(--palette-mint) text-ink',
  sky: 'bg-(--palette-sky) text-white',
  navy: 'bg-(--palette-navy) text-white',
}

export default async function GoodTasteTravels() {
  const data = await fetchCatalog<{
    clubCount?: number | null
    reviews?: Omit<TasteItem, 'verb' | 'href'>[] | null
    posts?: (Omit<TasteItem, 'verb' | 'href'> & {isDemoActivity?: boolean | null})[] | null
  }>(TASTE_TRAVELS_QUERY)

  const items = mergeFeed(data.reviews ?? [], data.posts ?? []).slice(0, 3)
  const clubCount = data.clubCount ?? 0

  return (
    <section className="border-y border-(--line) px-5 py-12 min-[875px]:px-9 min-[875px]:py-16">
      <div className="grid items-start gap-10 min-[875px]:grid-cols-2 min-[875px]:gap-x-12 xl:gap-x-16">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.62rem] font-medium tracking-[0.2em] text-muted uppercase">
                Your people, mid-chapter
              </p>
              <h2 className="mt-2 font-display text-[clamp(2rem,6vw,3.35rem)] leading-[0.95] font-black tracking-[-0.06em]">
                Good taste travels.
              </h2>
            </div>
            <Link
              href="/clubs"
              className="mt-1 grid size-9 shrink-0 place-items-center text-muted hover:text-ink"
              aria-label="Book clubs"
            >
              <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
                <circle cx="7" cy="7.2" r="2.2" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="13" cy="7.2" r="2.2" stroke="currentColor" strokeWidth="1.3" />
                <path
                  d="M3.6 14.2c.6-1.8 2-2.8 3.4-2.8s2.8 1 3.4 2.8M9.6 14.2c.6-1.8 2-2.8 3.4-2.8s2.8 1 3.4 2.8"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            </Link>
          </div>

          {items.length ? (
            <ul className="mt-8">
              {items.map((item) => (
                <li key={item._id} className="border-t border-(--line) py-5 last:border-b">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 grid size-10 shrink-0 place-items-center text-[0.68rem] font-medium tracking-[0.08em] ${AVATAR[item.spaceColor ?? ''] ?? 'bg-(--accent-soft) text-ink'}`}
                    >
                      {initials(item.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm leading-snug">
                          <span className="font-medium">{item.name || 'Reader'}</span>
                          <span className="text-muted">
                            {' '}
                            {item.verb}{' '}
                            {item.linkLabel ? (
                              <Link href={item.href} className="text-ink underline-offset-2 hover:underline">
                                {item.linkLabel}
                              </Link>
                            ) : null}
                          </span>
                        </p>
                        <p className="shrink-0 pt-0.5 text-[0.68rem] text-muted">{relativeTime(item._createdAt)}</p>
                      </div>
                      {item.body ? (
                        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink">
                          &ldquo;{clip(item.body, 140)}&rdquo;
                        </p>
                      ) : null}
                      <p className="mt-3 flex items-center gap-1.5 text-[0.62rem] font-medium tracking-[0.16em] text-muted uppercase">
                        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                          <path
                            d="M8 13.2S3.2 10.1 3.2 6.8A2.7 2.7 0 0 1 8 5.2 2.7 2.7 0 0 1 12.8 6.8C12.8 10.1 8 13.2 8 13.2Z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                        </svg>
                        That sounds good
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 max-w-md border-t border-(--line) pt-6 text-sm leading-relaxed text-muted">
              Quiet for now. When readers review a book in public or talk in a club, those notes will land here.
            </p>
          )}
        </div>

        <div
          className="relative flex aspect-square flex-col justify-between overflow-hidden bg-ink p-7 text-white min-[875px]:p-8"
        >
          <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute top-8 right-8 size-36 rounded-full border border-white/15" />
          <div className="relative flex items-start justify-between gap-4 text-[0.62rem] font-medium tracking-[0.18em] uppercase">
            <p>Worth gathering for</p>
            <p className="text-white/55">Spotlight</p>
          </div>
          <div className="relative">
            <p className="font-display text-[clamp(2rem,5.4vw,3.35rem)] leading-[0.92] font-black tracking-tighter">
              Read it.
              <span className="block">Share your take.</span>
              <span className="block">Read it again.</span>
            </p>
            <p className="mt-5 max-w-xs text-[0.95rem] leading-relaxed text-white/70">
              Find a book club that makes the last page feel like the beginning.
            </p>
          </div>
          <p className="relative flex items-center justify-between text-[0.68rem] font-medium tracking-[0.16em] uppercase">
            Meet the book clubs
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
              <path d="M4 4l8 8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 12h5V7" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </p>
        </div>
      </div>
    </section>
  )
}

function mergeFeed(
  reviews: Omit<TasteItem, 'verb' | 'href'>[],
  posts: (Omit<TasteItem, 'verb' | 'href'> & {isDemoActivity?: boolean | null})[],
) {
  const fromReviews: TasteItem[] = reviews
    .filter((item) => item._id && item.body)
    .map((item) => ({
      ...item,
      verb: 'reviewed',
      href: item.bookSlug ? `/books/${item.bookSlug}` : '/clubs',
      linkLabel: item.bookTitle,
    }))

  const fromPosts: TasteItem[] = posts
    .filter((item) => item._id && item.body && !item.isDemoActivity)
    .map((item) => ({
      ...item,
      verb: 'in',
      href: item.clubSlug ? `/clubs/${item.clubSlug}` : '/clubs',
      linkLabel: item.clubName,
    }))

  const genuine = [...fromReviews, ...fromPosts].sort(
    (a, b) => new Date(b._createdAt ?? 0).getTime() - new Date(a._createdAt ?? 0).getTime(),
  )
  return genuine
}

function initials(name?: string | null) {
  const parts = (name || 'Reader').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'R'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`
}

function relativeTime(value?: string | null) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days} days ago`
  return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric'}).format(new Date(value))
}
