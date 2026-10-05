import {useEffect, useState} from 'react'
import {Card, Flex, Stack, Text} from '@sanity/ui'
import {IntentLink} from 'sanity/router'
import {useClient, useFormValue, type StringInputProps} from 'sanity'
import {publishedDocumentId} from '../lib/catalog-origin'

type SeriesBook = {
  _id: string
  title?: string | null
  position?: number | null
  coverUrl?: string | null
  authors?: string[] | null
}

export function SeriesBooksInput(_props: StringInputProps) {
  const client = useClient({apiVersion: '2026-02-01'})
  const documentId = publishedDocumentId(useFormValue(['_id']) as string | undefined)
  const title = (useFormValue(['title']) as string | undefined)?.trim()
  const [books, setBooks] = useState<SeriesBook[] | null>(null)

  useEffect(() => {
    if (!documentId) return
    let cancelled = false
    client
      .fetch<SeriesBook[]>(
        `*[_type == "book" && !(_id in path("drafts.**")) && (
          series.bookSeries._ref == $seriesId ||
          (!defined(series.bookSeries) && defined($title) && lower(series.name) == lower($title))
        )] | order(series.position asc, title asc){
          _id,
          title,
          "position": series.position,
          "authors": array::unique(coalesce(authors, []) + coalesce(authorReferences[]->name, [])),
          "coverUrl": coalesce(
            coverOverride.asset->url,
            *[_type == "edition" && book._ref == ^._id && !(_id in path("drafts.**"))] | order(defined(coverOverride.asset) desc, defined(cover.url) desc)[0]{
              "url": coalesce(coverOverride.asset->url, cover.url, coverUrl)
            }.url
          )
        }`,
        {seriesId: documentId, title: title || ''},
      )
      .then((result) => {
        if (!cancelled) setBooks(result)
      })
      .catch(() => {
        if (!cancelled) setBooks([])
      })
    return () => {
      cancelled = true
    }
  }, [client, documentId, title])

  return (
    <Card padding={3} radius={2} border>
      <Stack gap={3}>
        <Text size={1} muted>
          Books in this series
        </Text>
        {!documentId ? (
          <Text size={1} muted>
            Save the series to see its books.
          </Text>
        ) : books === null ? (
          <Text size={1} muted>
            Loading books…
          </Text>
        ) : books.length === 0 ? (
          <Text size={1} muted>
            No books are linked to this series yet.
          </Text>
        ) : (
          <Stack gap={3}>
            {books.map((book) => (
              <Flex key={book._id} align="center" gap={3}>
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt=""
                    style={{width: 40, height: 60, objectFit: 'cover', flexShrink: 0}}
                  />
                ) : (
                  <Card tone="transparent" border style={{width: 40, height: 60, flexShrink: 0}} />
                )}
                <Stack gap={2}>
                  <Text size={1}>
                    {typeof book.position === 'number' ? `${book.position} · ` : ''}
                    <IntentLink intent="edit" params={{id: book._id, type: 'book'}}>
                      {book.title || 'Untitled book'}
                    </IntentLink>
                  </Text>
                  <Text size={1} muted>
                    {book.authors?.filter(Boolean).join(', ') || 'Author unknown'}
                  </Text>
                </Stack>
              </Flex>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
