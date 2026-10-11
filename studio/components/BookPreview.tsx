import {useEffect, useState} from 'react'
import {useClient, type PreviewProps} from 'sanity'
import {
  CATALOG_CLUBS_QUERY,
  CATALOG_SOURCE_LABELS,
  catalogClubNames,
  inferCatalogSource,
  publishedDocumentId,
  type CatalogClubLookup,
} from '../lib/catalog-origin'

type PreviewValues = PreviewProps & {
  bookId?: string
  author?: string
  authorRef?: string
  catalogReviewStatus?: string
  catalogSource?: string
  importKey?: string
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
      .fetch<CatalogClubLookup>(CATALOG_CLUBS_QUERY, {bookId})
      .then((result) => {
        if (!cancelled) setClubs(catalogClubNames(result))
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
