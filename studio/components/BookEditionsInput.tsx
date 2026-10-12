import {useEffect, useState} from 'react'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {IntentLink} from 'sanity/router'
import {useClient, useFormValue, type StringInputProps} from 'sanity'
import {publishedDocumentId} from '../lib/catalog-origin'

type Edition = {
  _id: string
  title?: string
  isbn13?: string
  isbn10?: string
  publisher?: string
  publicationDate?: string
  format?: string
  language?: string
  pageCount?: number
  translators?: string[]
  editionStatement?: string
  coverUrl?: string
}

export function BookEditionsInput(_props: StringInputProps) {
  const client = useClient({apiVersion: '2026-02-01'})
  const bookId = publishedDocumentId(useFormValue(['_id']) as string | undefined)
  const [result, setResult] = useState<{bookId: string; editions?: Edition[]; error?: string} | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!bookId) return
    let active = true
    let request = 0
    const filter = '*[_type == "edition" && book._ref in $bookIds]'
    const params = {bookIds: [bookId, `drafts.${bookId}`]}
    async function load() {
      const current = ++request
      try {
        const editions = await client.fetch<Edition[]>(
          `${filter} | order(publicationDate asc, publisher asc){
            _id, title, isbn13, isbn10, publisher, publicationDate, format, language,
            pageCount, translators, editionStatement,
            "coverUrl": coalesce(coverOverride.asset->url, cover.url, coverUrl)
          }`,
          params,
          {perspective: 'drafts', useCdn: false},
        )
        if (active && current === request) setResult({bookId: bookId!, editions})
      } catch {
        if (active && current === request) setResult({bookId: bookId!, error: 'Could not load editions. Please try refreshing.'})
      }
    }
    void load()
    const subscription = client.listen(filter, params, {includeResult: false}).subscribe({
      next: () => { void load() },
      error: () => { /* The refresh button remains available if live updates disconnect. */ },
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [bookId, client, refresh])

  const current = result?.bookId === bookId ? result : null
  return (
    <Card padding={3} radius={2} border>
      <Stack gap={4}>
        <Flex justify="space-between" align="center" gap={3}>
          <Text size={1} muted>{current?.editions ? `${current.editions.length} linked ${current.editions.length === 1 ? 'edition' : 'editions'}` : 'Linked editions'}</Text>
          <Button text="Refresh" mode="ghost" fontSize={1} onClick={() => setRefresh((value) => value + 1)} disabled={!bookId} />
        </Flex>
        {!bookId ? <Text size={1} muted>Save this book to see its editions.</Text>
          : current?.error ? <Text size={1}>{current.error}</Text>
          : !current?.editions ? <Text size={1} muted>Loading editions…</Text>
          : !current.editions.length ? <Text size={1} muted>No editions are linked yet. Add one in Everlogue Catalog → Editions and select this book.</Text>
          : current.editions.map((edition) => (
            <Card key={edition._id} padding={3} radius={2} border>
              <Flex gap={3} align="flex-start">
                {edition.coverUrl ? <img src={edition.coverUrl} alt="" style={{width: 48, height: 72, objectFit: 'cover', flexShrink: 0}} /> : null}
                <Stack gap={3}>
                  <Text size={1} weight="semibold">
                    <IntentLink intent="edit" params={{id: publishedDocumentId(edition._id), type: 'edition'}}>
                      {edition.title || 'Untitled edition'}
                    </IntentLink>
                  </Text>
                  <Text size={1}>{[edition.format, edition.publisher, edition.publicationDate].filter(Boolean).join(' · ') || 'Publication details not recorded'}</Text>
                  <Text size={1} muted>{[edition.language, edition.pageCount != null ? `${edition.pageCount} pages` : null, edition.editionStatement].filter(Boolean).join(' · ') || 'Edition details not recorded'}</Text>
                  <Text size={1}>ISBN: {edition.isbn13 || edition.isbn10 || 'Not recorded'}</Text>
                  {edition.translators?.length ? <Text size={1} muted>Translated by {edition.translators.join(', ')}</Text> : null}
                </Stack>
              </Flex>
            </Card>
          ))}
      </Stack>
    </Card>
  )
}
