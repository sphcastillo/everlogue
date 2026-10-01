import {useEffect, useState} from 'react'
import {Box, Card, Stack, Text} from '@sanity/ui'
import {useClient, useFormValue, type StringInputProps} from 'sanity'
import {CATALOG_SOURCE_LABELS, inferCatalogSource, publishedDocumentId} from '../lib/catalog-origin'

type ClubTitles = {clubs?: string[] | null; celebrity?: string[] | null}

function uniqueNames(values: unknown[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value && String(value).trim())))]
}

export function CatalogOriginInput(_props: StringInputProps) {
  const client = useClient({apiVersion: '2026-02-01'})
  const documentId = publishedDocumentId(useFormValue(['_id']) as string | undefined)
  const catalogSource = useFormValue(['catalogSource']) as string | undefined
  const importKey = useFormValue(['importKey']) as string | undefined
  const [clubs, setClubs] = useState<string[]>([])

  useEffect(() => {
    if (!documentId) return
    let cancelled = false
    client
      .fetch<ClubTitles>(
        `{
          "clubs": *[_type == "curatedCollection" && count(books[book._ref == $bookId]) > 0].title,
          "celebrity": *[_type == "celebritySelection" && count(books[_ref == $bookId]) > 0].club->title
        }`,
        {bookId: documentId},
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
  }, [client, documentId])

  const source = inferCatalogSource({catalogSource, importKey, documentId, clubNames: clubs})

  return (
    <Card padding={3} radius={2} tone="transparent" border>
      <Stack gap={4}>
        <Box>
          <Text size={1} muted>
            Added from
          </Text>
          <Box marginTop={2}>
            <Text size={2} weight="semibold">
              {source ? CATALOG_SOURCE_LABELS[source] : 'Not recorded'}
            </Text>
          </Box>
        </Box>
        <Box>
          <Text size={1} muted>
            Book club
          </Text>
          <Box marginTop={2}>
            <Text size={2} weight="semibold">
              {clubs.length ? clubs.join(', ') : 'None'}
            </Text>
          </Box>
        </Box>
      </Stack>
    </Card>
  )
}
