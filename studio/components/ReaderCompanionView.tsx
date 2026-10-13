import {useEffect, useState} from 'react'
import {Box, Card, Stack, Text} from '@sanity/ui'
import {IntentLink} from 'sanity/router'
import {useClient} from 'sanity'
import {publishedDocumentId} from '../lib/catalog-origin'

type CompanionConversationRow = {
  _id: string
  updatedAt?: string | null
  messageCount: number
  email?: string | null
  name?: string | null
}

export function ReaderCompanionView({document}: {document: {displayed?: {_id?: string}}}) {
  const client = useClient({apiVersion: '2026-02-01'})
  const readerId = publishedDocumentId(document.displayed?._id)
  const [conversations, setConversations] = useState<CompanionConversationRow[] | null>(null)

  useEffect(() => {
    if (!readerId) return
    let cancelled = false
    client
      .fetch<CompanionConversationRow[]>(
        `*[_type == "companionConversation" && reader._ref == $readerId && !(_id in path("drafts.**"))] | order(updatedAt desc){
          _id,
          updatedAt,
          "messageCount": count(messages),
          "email": reader->email,
          "name": reader->displayName
        }`,
        {readerId},
      )
      .then((result) => {
        if (!cancelled) setConversations(result)
      })
      .catch(() => {
        if (!cancelled) setConversations([])
      })
    return () => {
      cancelled = true
    }
  }, [readerId, client])

  return (
    <Box padding={4}>
      <Stack gap={4}>
        {conversations === null ? (
          <Text muted>Loading companion conversations…</Text>
        ) : conversations.length === 0 ? (
          <Text muted>No saved reading companion conversation for this account.</Text>
        ) : (
          conversations.map((conversation) => (
            <Card key={conversation._id} padding={4} radius={2} border>
              <Stack gap={3}>
                <Text weight="semibold">
                  {conversation.email || conversation.name || 'Signed-in reader'}
                </Text>
                <Text size={1} muted>
                  {conversation.messageCount} {conversation.messageCount === 1 ? 'message' : 'messages'}
                  {conversation.updatedAt ? ` · Updated ${conversation.updatedAt}` : ''}
                </Text>
                <Text size={1}>
                  <IntentLink intent="edit" params={{id: conversation._id, type: 'companionConversation'}}>
                    Open conversation
                  </IntentLink>
                </Text>
              </Stack>
            </Card>
          ))
        )}
      </Stack>
    </Box>
  )
}
