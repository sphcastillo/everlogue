import {useEffect, useState} from 'react'
import {useClient, type PreviewProps} from 'sanity'

type PreviewValues = PreviewProps & {
  bookId?: string
  author?: string
  catalogReviewStatus?: string
  catalogSource?: string
  club0?: string
  club1?: string
  club2?: string
}

function publishedId(id?: string) {
  return (id || '').replace(/^drafts\./, '')
}

function uniqueNames(values: unknown[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value && String(value).trim())))]
}

export function BookPreview(props: PreviewProps) {
  const values = props as PreviewValues
  const bookId = publishedId(values.bookId)
  const selected = uniqueNames([values.club0, values.club1, values.club2])
  const [clubs, setClubs] = useState<string[]>(selected)
  const client = useClient({apiVersion: '2026-02-01'})

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    client
      .fetch<{clubs?: string[]; celebrity?: string[]}>(
        `{
          "clubs": *[_type == "curatedCollection" && (references($bookId) || $bookId in books[].book._ref)].title,
          "celebrity": *[_type == "celebritySelection" && (references($bookId) || $bookId in books[]._ref)].club->title
        }`,
        {bookId},
      )
      .then((result) => {
        const names = uniqueNames([...(result?.clubs || []), ...(result?.celebrity || []), ...selected])
        if (!cancelled) setClubs(names)
      })
      .catch(() => {
        if (!cancelled) setClubs(selected)
      })
    return () => {
      cancelled = true
    }
  }, [bookId, client, values.club0, values.club1, values.club2])

  const review =
    values.catalogReviewStatus === 'reviewed'
      ? 'Reviewed'
      : values.catalogReviewStatus === 'needsReview'
        ? 'Needs review'
        : ''
  const source =
    values.catalogSource === 'goodreadsImport'
      ? 'Goodreads import'
      : values.catalogSource === 'readerSearch'
        ? 'Reader search'
        : values.catalogSource === 'bookClubImport'
          ? 'Book club import'
          : ''
  const subtitle = [values.author, review, source, clubs.join(', ')].filter(Boolean).join(' · ')

  if (typeof props.renderDefault === 'function') {
    return props.renderDefault({...props, title: values.title, subtitle, media: values.media})
  }
  return null
}
