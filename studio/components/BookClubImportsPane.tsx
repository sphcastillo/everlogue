import type {SanityClient} from '@sanity/client'
import {useEffect, useMemo, useState} from 'react'
import {Box, Card, Flex, Spinner, Stack, Text, TextInput, Button} from '@sanity/ui'
import {SearchIcon} from '@sanity/icons'
import {useClient} from 'sanity'
import {IntentLink, useRouter} from 'sanity/router'
import {openCatalogImport} from '../../src/lib/book-club-watch/catalog-review'
import {CLUBS, type Discovery} from '../../src/lib/book-club-watch/model'
import {BOOKCLUB_IMPORTS_FILTER} from '../lib/catalog-request-filters'

type Row = {
  _id: string
  title?: string | null
  author?: string | null
  authors?: string[] | null
  catalogReviewStatus?: string | null
  clubs?: string[] | null
  celebrityClubs?: string[] | null
  manualCoverUrl?: string | null
}

type DiscoveryRow = Discovery & {matchedManualCoverUrl?: string | null}

function CoverThumbnail({src, title}: {src?: string | null; title: string}) {
  if (!src) return null
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        width: 64,
        height: 96,
        flex: '0 0 64px',
        overflow: 'hidden',
        background: 'var(--card-muted-bg-color)',
      }}
    >
      <img
        src={src}
        alt={`Cover of ${title}`}
        style={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}}
      />
    </Flex>
  )
}

function clubLabel(row: Row) {
  return [...new Set([...(row.clubs || []), ...(row.celebrityClubs || [])].filter(Boolean))].join(', ')
}

function reviewLabel(status?: string | null) {
  if (status === 'needsReview') return 'Needs review'
  if (status === 'reviewed') return 'Reviewed'
  return 'Unmarked'
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function matchesSearch(row: Row, query: string) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const haystack = normalize(
    [
      row.title,
      row.author,
      ...(row.authors || []),
      clubLabel(row),
      reviewLabel(row.catalogReviewStatus),
      row._id,
    ]
      .filter(Boolean)
      .join(' '),
  )
  return tokens.every((token) => haystack.includes(token))
}

export function BookClubImportsPane() {
  const client = useClient({apiVersion: '2026-02-01'})
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [discoveries, setDiscoveries] = useState<DiscoveryRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadDiscoveries = () => client.fetch<DiscoveryRow[]>(`*[
      _type == "bookClubDiscovery" &&
      status in ["discovered", "needs_review"] &&
      !(_id in path("drafts.**"))
    ] | order(discoveredAt desc){
      ...,
      "matchedManualCoverUrl": matchedBook->coverOverride.asset->url
    }`, {}, {perspective: 'raw', useCdn: false})
      .then(docs => { if (!cancelled) setDiscoveries(docs) })
      .catch(() => { if (!cancelled) setError('Could not load Watch discoveries.') })
    void loadDiscoveries()
    const subscription = client.listen('*[_type in ["book", "bookClubDiscovery"]]').subscribe(() => { void loadDiscoveries() })
    client
      .fetch<Row[]>(
        `*[${BOOKCLUB_IMPORTS_FILTER} && !(_id in path("drafts.**"))] | order(_createdAt desc) {
          _id,
          title,
          authors,
          "author": authors[0],
          catalogReviewStatus,
          "clubs": *[_type == "curatedCollection" && references(^._id)].title,
          "celebrityClubs": *[_type == "celebritySelection" && references(^._id)].club->name,
          "manualCoverUrl": coverOverride.asset->url
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
      subscription.unsubscribe()
    }
  }, [client])

  const visible = useMemo(() => (rows || []).filter((row) => matchesSearch(row, query)), [rows, query])

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

  if (!rows.length && !discoveries.length) {
    return (
      <Box padding={4}>
        <Text muted>No unmarked or needs-review book club imports.</Text>
      </Box>
    )
  }

  return (
    <Stack padding={3} gap={2}>
      <Box padding={2} paddingBottom={1}>
        <TextInput
          icon={SearchIcon}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search title, author, or book club"
          aria-label="Search book club imports"
        />
      </Box>
      <Box padding={2} paddingBottom={3}>
        <Text size={1} muted>
          {discoveries.length} Watch discoveries · {visible.length} catalog imports
        </Text>
      </Box>
      {discoveries.filter(doc => matchesSearch({ _id: doc._id, title: doc.discoveredTitle, author: doc.discoveredAuthor, clubs: [CLUBS[doc.bookClub].name]}, query)).map(doc => (
        <Card key={doc._id} padding={3} radius={2} shadow={1}>
          <Flex gap={3} align="flex-start">
            <CoverThumbnail
              src={doc.matchedManualCoverUrl}
              title={doc.discoveredTitle}
            />
            <Stack gap={2} style={{flex: 1}}>
              <Text weight="semibold">{doc.discoveredTitle}</Text>
              <Text size={1}>{doc.discoveredAuthor || 'Author unknown'}</Text>
              <Text size={1} muted>{CLUBS[doc.bookClub].name} · {doc.selectionMonth}</Text>
              <Text size={1}>Discovered by Book Club Watch. Review here, then Publish to approve.</Text>
              {doc.processingError && <Text size={1}>{doc.processingError}</Text>}
              <Button text="Review book import" disabled={busy !== null} loading={busy === doc._id} onClick={async () => {
                setBusy(doc._id)
                try { const id = await openCatalogImport(client as unknown as SanityClient, doc._id); router.navigateIntent('edit', {id, type: 'book'}) }
                catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not open import.') }
                finally { setBusy(null) }
              }} />
            </Stack>
          </Flex>
        </Card>
      ))}
      {visible.length ? (
        visible.map((row) => {
          const clubs = clubLabel(row)
          return (
            <IntentLink
              key={row._id}
              intent="edit"
              params={{id: row._id, type: 'book'}}
              style={{textDecoration: 'none', color: 'inherit'}}
            >
              <Card padding={3} radius={2} shadow={1}>
                <Flex gap={3} align="flex-start">
                  <CoverThumbnail src={row.manualCoverUrl} title={row.title || 'Untitled'} />
                  <Stack gap={2} style={{flex: 1}}>
                    <Text weight="semibold">{row.title || 'Untitled'}</Text>
                    <Text size={1}>{row.author || 'Author unknown'}</Text>
                    <Text size={1} muted>{clubs || 'Club not linked'}</Text>
                    <Text size={1} muted>{reviewLabel(row.catalogReviewStatus)}</Text>
                  </Stack>
                </Flex>
              </Card>
            </IntentLink>
          )
        })
      ) : (
        <Box padding={3}>
          <Text muted>No other catalog imports{query.trim() ? ` matching “${query.trim()}”` : ''}.</Text>
        </Box>
      )}
    </Stack>
  )
}
