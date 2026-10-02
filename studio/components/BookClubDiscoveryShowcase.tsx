import {Card, Stack, Text, Box} from '@sanity/ui'
import {IntentLink} from 'sanity/router'
import {CLUBS, type Discovery} from '../../src/lib/book-club-watch/model'

export function BookClubDiscoveryShowcase({document}: {document: {displayed: Discovery & {catalogBook?: {_ref: string}}}}) {
  const doc = document.displayed
  return <Box padding={4}><Card padding={4} radius={2} shadow={1}><Stack gap={4}>
    {doc.proposedMetadata?.coverUrl && <img src={doc.proposedMetadata.coverUrl} alt="" style={{width: 160, maxHeight: 240, objectFit: 'contain'}} />}
    <Text size={3} weight="bold">{doc.discoveredTitle}</Text>
    <Text>{doc.discoveredAuthor}</Text>
    <Text muted>{CLUBS[doc.bookClub]?.name} · {doc.selectionMonth} · {doc.status}</Text>
    <Text><a href={doc.sourceUrl} target="_blank" rel="noreferrer">{doc.sourceName}</a></Text>
    <Text size={1}>{doc.sourceEvidence}</Text>
    <Text size={1}>Review and publish this title in Everlogue Catalog Requests → Bookclub imports. Publishing files this discovery under Approved.</Text>
    {doc.catalogBook && <IntentLink intent="edit" params={{id: doc.catalogBook._ref, type: 'book'}}>Open catalog book</IntentLink>}
    {(doc.processingError || doc.enrichmentError) && <Text size={1}>{doc.processingError || doc.enrichmentError}</Text>}
  </Stack></Card></Box>
}
