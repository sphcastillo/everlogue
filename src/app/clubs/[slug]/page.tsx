import {notFound} from 'next/navigation'
import {fetchCatalog} from '@/sanity/fetch'
import {COMMUNITY_CLUB_BY_SLUG_QUERY} from '@/sanity/queries'
import {getClubExperience} from '@/lib/actions'
import {getOptionalReader} from '@/lib/reader'
import {BookCard, type BookCardData} from '@/components/BookCard'
import {ClubActions} from '@/components/ClubActions'
import {PageHeader} from '@/components/PageHeader'

export default async function ClubPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params
  const club = await fetchCatalog<{
    _id: string
    name: string
    description?: string
    isDemoClub?: boolean
    currentRead?: BookCardData | null
  } | null>(COMMUNITY_CLUB_BY_SLUG_QUERY, {slug})
  if (!club) notFound()

  const reader = await getOptionalReader().catch(() => null)
  const experience = (await getClubExperience(club._id)) as {
    membership?: {role?: string; status?: string} | null
    poll?: {
      _id: string
      title: string
      status: string
      options?: {_id: string; title?: string; authors?: {name?: string}[]}[]
      tallies?: {_ref: string; count: number}[]
      myVote?: string | null
    } | null
    thread?: {
      _id: string
      title: string
      spoilerBoundary?: string
      isDemoThread?: boolean
      posts?: {
        _id: string
        body: string
        hasSpoilers?: boolean
        isDemoActivity?: boolean
        authorName?: string
        _createdAt?: string
      }[]
    } | null
  }

  const member = experience.membership?.status === 'active'

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <PageHeader eyebrow="Book club" title={club.name} lede={club.description} />
        {club.isDemoClub ? <span className="pill mb-1 px-2 py-1 text-xs">Demo club</span> : null}
      </div>
      <ClubActions clubId={club._id} signedIn={Boolean(reader)} isMember={member} />
      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-3xl">Current read</h2>
        {club.currentRead ? (
          <div className="mt-4 w-40">
            <BookCard book={club.currentRead} />
          </div>
        ) : (
          <p className="mt-3 text-[var(--muted)]">No current read selected.</p>
        )}
      </section>
      {experience.poll ? (
        <section className="mt-10 surface p-5">
          <h2 className="font-[family-name:var(--font-display)] text-3xl">{experience.poll.title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">One vote per member. Status: {experience.poll.status}.</p>
          <ClubActions
            clubId={club._id}
            poll={experience.poll}
            signedIn={Boolean(reader)}
            isMember={member}
          />
        </section>
      ) : null}
      {experience.thread ? (
        <section className="mt-10">
          <h2 className="font-[family-name:var(--font-display)] text-3xl">{experience.thread.title}</h2>
          {experience.thread.isDemoThread ? (
            <p className="mt-2 text-sm text-[var(--accent)]">Demo discussion — separate from genuine reader posts.</p>
          ) : null}
          <ul className="mt-6 space-y-3">
            {(experience.thread.posts || []).map((post) => (
              <li key={post._id} className="surface p-4">
                <p className="text-sm text-[var(--muted)]">
                  {post.authorName || 'Reader'}
                  {post.isDemoActivity ? ' · demo activity' : ''}
                </p>
                {post.hasSpoilers ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm">Contains spoilers</summary>
                    <p className="mt-2 whitespace-pre-wrap">{post.body}</p>
                  </details>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap">{post.body}</p>
                )}
              </li>
            ))}
          </ul>
          {member ? <ClubActions clubId={club._id} threadId={experience.thread._id} signedIn isMember /> : null}
        </section>
      ) : null}
    </div>
  )
}
