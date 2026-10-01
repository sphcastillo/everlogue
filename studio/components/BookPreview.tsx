import {useEffect, useState} from 'react'
import {useClient, type PreviewProps} from 'sanity'
import {CATALOG_SOURCE_LABELS, inferCatalogSource, publishedDocumentId} from '../lib/catalog-origin'

type PreviewValues = PreviewProps & {
  bookId?: string
  author?: string
  authorRef?: string
  catalogReviewStatus?: string
  catalogSource?: string
  importKey?: string
}

function uniqueNames(values: unknown[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value && String(value).trim())))]
}

export function BookPreview(props: PreviewProps) {
  const values = props as PreviewValues
  const bookId = publishedDocumentId(values.bookId)
  const [clubs, setClubs] = useState<string[]>([])
  const client = useClient({apiVersion: '2026-02-01'})

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    client
      .fetch<{clubs?: string[]; celebrity?: string[]}>(
        `{
          "clubs": *[_type == "curatedCollection" && count(books[book._ref == $bookId]) > 0].title,
          "celebrity": *[_type == "celebritySelection" && count(books[_ref == $bookId]) > 0].club->title
        }`,
        {bookId},
      )
      .then((result) => {
        if (!cancelled) setClubs(uniqueNames([...(result?.clubs || []), ...(result?.celebrity || [])]))
      })
      .catch(() => {
        if (!cancelled) setClubs([])
      })
    return () => {
      cancelled = true
    }
  }, [bookId, client])

  const review =
    values.catalogReviewStatus === 'reviewed'
      ? 'Reviewed'
      : values.catalogReviewStatus === 'needsReview'
        ? 'Needs review'
        : ''
  const source = inferCatalogSource({
    catalogSource: values.catalogSource,
    importKey: values.importKey,
    documentId: bookId,
    clubNames: clubs,
  })
  const sourceLabel = source ? CATALOG_SOURCE_LABELS[source] : ''
  const author =
    [values.author, values.authorRef, values.subtitle].find(
      (value) => typeof value === 'string' && value.trim() && !['Reviewed', 'Needs review'].includes(value),
    ) || ''
  const subtitle = [author, review, sourceLabel, clubs.join(', ')].filter(Boolean).join(' · ')

  if (typeof props.renderDefault === 'function') {
    return props.renderDefault({...props, title: values.title, subtitle, media: values.media})
  }
  return null
}
