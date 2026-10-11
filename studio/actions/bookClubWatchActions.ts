import type {SanityClient} from '@sanity/client'
import {useEffect, useState} from 'react'
import {useClient, useCurrentUser, type DocumentActionComponent, type DocumentActionsContext} from 'sanity'
import {useToast} from '@sanity/ui/toast'
import {completeCatalogReview} from '../../src/lib/book-club-watch/catalog-review'

function watchStatusAction(operation: 'reject' | 'reopen'): DocumentActionComponent {
  return function WatchAction(props) {
    const client = useClient({apiVersion: '2026-09-01'}), user = useCurrentUser(), toast = useToast()
    const [busy, setBusy] = useState(false)
    const doc = props.published
    if (!doc || (operation === 'reject' ? !['needs_review', 'discovered'].includes(String(doc.status)) : doc.status !== 'rejected')) return null
    return {
      label: operation === 'reject' ? 'Reject' : 'Reopen for review', disabled: busy || !user,
      onHandle: async () => {
        setBusy(true)
        try {
          await client.patch(props.id).ifRevisionId(doc._rev).set({status: operation === 'reject' ? 'rejected' : 'needs_review', reviewedBy: user!.id}).commit()
          props.onComplete()
        } catch { toast.push({status: 'error', title: 'Discovery changed. Reload and try again.'}) }
        finally { setBusy(false) }
      },
    }
  }
}

function withWatchCompletion(PublishAction: DocumentActionComponent): DocumentActionComponent {
  const PublishWithWatch: DocumentActionComponent = props => {
    const client = useClient({apiVersion: '2026-09-01'}), user = useCurrentUser(), toast = useToast()
    const action = PublishAction(props)
    const watchId = (props.published as {watchDiscovery?: {_ref?: string}} | null)?.watchDiscovery?._ref
    useEffect(() => {
      if (props.draft || !props.published || !watchId) return
      let cancelled = false
      void completeCatalogReview(client as unknown as SanityClient, props.id, user?.id || 'studio-editor')
        .catch(error => {
          if (cancelled) return
          toast.push({
            status: 'error',
            title: 'Watch review is still open',
            description: error instanceof Error ? error.message : 'Use Finish Watch review to add this book to the club list.',
          })
        })
      return () => {
        cancelled = true
      }
    }, [props.draft, props.id, props.published?._rev, watchId, client, user?.id, toast])
    return action
  }
  PublishWithWatch.action = PublishAction.action
  return PublishWithWatch
}
const finishWatchReview: DocumentActionComponent = props => {
  const client = useClient({apiVersion: '2026-09-01'}), user = useCurrentUser(), toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!props.published?.watchDiscovery || props.draft) return null
  return {label: 'Finish Watch review', disabled: busy, onHandle: async () => {
    setBusy(true)
    try {
      await completeCatalogReview(client as unknown as SanityClient, props.id, user?.id || 'studio-editor')
      toast.push({status: 'success', title: 'Watch review complete'})
      props.onComplete()
    } catch (error) { toast.push({status: 'error', title: error instanceof Error ? error.message : 'Could not finish Watch review'}) }
    finally { setBusy(false) }
  }}
}
const watchActions = [watchStatusAction('reject'), watchStatusAction('reopen')]
export function bookClubWatchActions(prev: DocumentActionComponent[], context: DocumentActionsContext) {
  if (context.schemaType === 'bookClubWatchRun') return []
  if (context.schemaType === 'book') return [...prev.map(action => action.action === 'publish' ? withWatchCompletion(action) : action), finishWatchReview]
  if (context.schemaType !== 'bookClubDiscovery') return prev
  return watchActions
}
