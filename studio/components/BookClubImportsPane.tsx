import {useEffect, useState} from 'react'
import {Box, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useClient} from 'sanity'
import {IntentLink} from 'sanity/router'
import {BOOKCLUB_IMPORTS_FILTER} from '../lib/catalog-request-filters'

type Row = {
  _id: string
  title?: string | null
  author?: string | null
  catalogReviewStatus?: string | null
  clubs?: string[] | null
  celebrityClubs?: string[] | null
}

function clubLabel(row: Row) {
  return [...new Set([...(row.clubs || []), ...(row.celebrityClubs || [])].filter(Boolean))].join(', ')
}

function reviewLabel(status?: string | null) {
  if (status === 'needsReview') return 'Needs review'
  if (status === 'reviewed') return 'Reviewed'
  return 'Unmarked'
}

export function BookClubImportsPane() {
  const client = useClient({apiVersion: '2026-02-01'})
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    client
      .fetch<Row[]>(
        `*[${BOOKCLUB_IMPORTS_FILTER} && !(_id in path("drafts.**"))] | order(_createdAt desc) {
          _id,
          title,
          "author": authors[0],
          catalogReviewStatus,
          "clubs": *[_type == "curatedCollection" && (references(^._id) || ^._id in books[].book._ref)].title,
          "celebrityClubs": *[_type == "celebritySelection" && (references(^._id) || ^._id in books[]._ref)].club->title
        }`,
      )
      .then((docs) => {
        if (!cancelled) setRows(docs || [])
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load book club imports.')
      })
    return () => {
      cancelled = true
    }
  }, [client])

  if (error) {
    return (
      <Box padding={4}>
        <Text>{error}</Text>
      </Box>
    )
  }

  if (!rows) {
    return (
      <Flex padding={5} justify="center">
        <Spinner muted />
      </Flex>
    )
  }

  if (!rows.length) {
    return (
      <Box padding={4}>
        <Text muted>No unmarked or needs-review book club imports.</Text>
      </Box>
    )
  }

  return (
    <Stack padding={3} gap={2}>
      <Box padding={2} paddingBottom={3}>
        <Text size={1} muted>
          {rows.length} {rows.length === 1 ? 'book' : 'books'}
        </Text>
      </Box>
      {rows.map((row) => {
        const clubs = clubLabel(row)
        return (
          <IntentLink
            key={row._id}
            intent="edit"
            params={{id: row._id, type: 'book'}}
            style={{textDecoration: 'none', color: 'inherit'}}
          >
            <Card padding={3} radius={2} shadow={1}>
              <Stack gap={2}>
                <Text weight="semibold">{row.title || 'Untitled'}</Text>
                <Text size={1} muted>
                  {[row.author, reviewLabel(row.catalogReviewStatus), clubs || 'Club not linked']
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Stack>
            </Card>
          </IntentLink>
        )
      })}
    </Stack>
  )
}
