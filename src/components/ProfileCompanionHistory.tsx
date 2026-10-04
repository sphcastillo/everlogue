'use client'

import Link from 'next/link'
import {useState} from 'react'
import {BookCover, type CoverSource} from './BookCover'

type CompanionRecommendation = {
  _id: string
  title: string
  slug: string
  cover?: CoverSource | null
  recommendationKey: string
}

type CompanionRecommendationGroup = {
  _key: string
  recommendedAt: string
  books: CompanionRecommendation[]
}

function recommendationDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function ProfileCompanionHistory({
  initialGroups,
  initialHasHistory,
}: {
  initialGroups: CompanionRecommendationGroup[]
  initialHasHistory: boolean
}) {
  const [groups, setGroups] = useState(initialGroups)
  const [hasHistory, setHasHistory] = useState(initialHasHistory)
  const [deleting, setDeleting] = useState(false)
  const [removing, setRemoving] = useState('')
  const [error, setError] = useState('')

  async function removeRecommendation(recommendationKey: string) {
    setRemoving(recommendationKey)
    setError('')
    try {
      const response = await fetch('/api/companion/history', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({recommendationKey}),
      })
      if (!response.ok) throw new Error('Unable to remove this recommendation.')
      setGroups(current => current
        .map(group => ({
          ...group,
          books: group.books.filter(book => book.recommendationKey !== recommendationKey),
        }))
        .filter(group => group.books.length > 0))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to remove this recommendation.')
    } finally {
      setRemoving('')
    }
  }

  async function deleteHistory() {
    if (!window.confirm('Delete your reading companion conversation?')) return
    setDeleting(true)
    setError('')
    try {
      const response = await fetch('/api/companion/history', {method: 'DELETE'})
      if (!response.ok) throw new Error('Unable to delete this conversation.')
      setGroups([])
      setHasHistory(false)
      window.dispatchEvent(new CustomEvent('everlogue:companion-history-cleared'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete this conversation.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-(--line) pb-3">
        <h2 className="font-display text-[1.45rem] leading-none font-black tracking-[-0.04em]">
          Reading companion recommendations
        </h2>
        {hasHistory ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => void deleteHistory()}
            className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete history'}
          </button>
        ) : null}
      </div>

      {groups.length ? (
        <div className="mt-6 space-y-9">
          {groups.map(group => (
            <section key={group._key} aria-labelledby={`recommendations-${group._key}`}>
              <h3
                id={`recommendations-${group._key}`}
                className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase"
              >
                Recommended <time dateTime={group.recommendedAt}>{recommendationDate(group.recommendedAt)}</time>
              </h3>
              <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(7rem,8rem))] gap-x-4 gap-y-6">
                {group.books.map(book => (
                  <li key={book.recommendationKey} className="min-w-0">
                    <div className="relative">
                      <Link href={`/books/${encodeURIComponent(book.slug)}`} className="group block">
                        <BookCover
                          cover={book.cover}
                          title={book.title}
                          className="aspect-2/3 w-full"
                          imageWidth={256}
                          sizes="128px"
                        />
                      </Link>
                      <button
                        type="button"
                        disabled={removing === book.recommendationKey}
                        onClick={() => void removeRecommendation(book.recommendationKey)}
                        aria-label={`Remove ${book.title} from recommendations`}
                        className="absolute top-1.5 right-1.5 z-10 grid size-7 place-items-center bg-paper/95 text-ink shadow-sm hover:bg-white disabled:opacity-50"
                      >
                        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                          <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      </button>
                    </div>
                    <Link
                      href={`/books/${encodeURIComponent(book.slug)}`}
                      className="mt-2 block text-sm font-medium leading-snug hover:underline hover:underline-offset-4"
                    >
                      {book.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Your reading companion recommendations will appear here after you start a conversation.
        </p>
      )}
      {error ? <p className="mt-3 text-sm text-(--palette-clay)" role="alert">{error}</p> : null}
    </section>
  )
}
