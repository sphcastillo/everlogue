import {useEffect, useState} from 'react'
import {Box, Card, Stack, Text} from '@sanity/ui'
import {IntentLink} from 'sanity/router'
import {useClient} from 'sanity'
import {publishedDocumentId} from '../lib/catalog-origin'

type BookRating = {
  _id: string
  value?: number | null
  readerName?: string | null
}

export function BookRatingsView({document}: {document: {displayed?: {_id?: string; ratingStats?: {average?: number | null; count?: number | null}}}}) {
  const client = useClient({apiVersion: '2026-02-01'})
  const bookId = publishedDocumentId(document.displayed?._id)
  const stats = document.displayed?.ratingStats
  const [ratings, setRatings] = useState<BookRating[] | null>(null)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    client
      .fetch<BookRating[]>(
        `*[_type == "rating" && book._ref == $bookId && !(_id in path("drafts.**"))] | order(value desc, _updatedAt desc){
          _id, value, "readerName": reader->displayName
        }`,
        {bookId},
      )
      .then((result) => {
        if (!cancelled) setRatings(result)
      })
      .catch(() => {
        if (!cancelled) setRatings([])
      })
    return () => {
      cancelled = true
    }
  }, [bookId, client])

  return (
    <Box padding={4}>
      <Stack gap={4}>
        <Card padding={4} radius={2} border>
          <Stack gap={3}>
            <Text size={1} muted>
              Everlogue rating stats
            </Text>
            <Text size={2} weight="semibold">
              {typeof stats?.count === 'number' && stats.count > 0
                ? `${stats.average ?? '—'} average · ${stats.count} ${stats.count === 1 ? 'rating' : 'ratings'}`
                : 'No Everlogue ratings yet'}
            </Text>
          </Stack>
        </Card>
        <Stack gap={3}>
          {ratings === null ? (
            <Text muted>Loading ratings…</Text>
          ) : ratings.length === 0 ? (
            <Text muted>No reader ratings for this book.</Text>
          ) : (
            ratings.map((rating) => (
              <Card key={rating._id} padding={3} radius={2} border>
                <Stack gap={2}>
                  <Text weight="semibold">{rating.value ?? '—'} ★</Text>
                  <Text size={1} muted>
                    {rating.readerName || 'Reader'}
                  </Text>
                  <Text size={1}>
                    <IntentLink intent="edit" params={{id: rating._id, type: 'rating'}}>
                      Open rating
                    </IntentLink>
                  </Text>
                </Stack>
              </Card>
            ))
          )}
        </Stack>
      </Stack>
    </Box>
  )
}
