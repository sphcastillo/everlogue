import {useState} from 'react'
import {useClient, useCurrentUser, type DocumentActionComponent, type DocumentActionsContext} from 'sanity'
import {useToast} from '@sanity/ui/toast'
import {approvalFor, type Discovery} from '../../src/lib/book-club-watch/model'

type Operation = 'approve' | 'reject' | 'reopen' | 'retry'
function action(operation: Operation): DocumentActionComponent {
  return function WatchAction(props) {
    const client = useClient({apiVersion: '2026-09-01'}), user = useCurrentUser(), toast = useToast()
    const [busy, setBusy] = useState(false)
    const status = props.published?.status || props.draft?.status
    const allowed = operation === 'approve' || operation === 'reject' ? status === 'needs_review' : operation === 'reopen' ? status === 'rejected' : status === 'approved'
    if (!allowed) return null
    return {
      label: {approve: 'Approve and publish to catalog', reject: 'Reject', reopen: 'Reopen for review', retry: 'Retry publication'}[operation],
      disabled: busy || !user,
      onHandle: async () => {
        setBusy(true)
        try {
          const docs = await client.fetch<Discovery[]>('*[_id in $ids]', {ids: [props.id, `drafts.${props.id}`]}, {perspective: 'raw'})
          const live = docs.find((doc) => doc._id === props.id), draft = docs.find((doc) => doc._id.startsWith('drafts.'))
          if (!live) throw new Error('Discovery is missing. Reload Studio.')
          if ((operation === 'approve' || operation === 'reject') && live.status !== 'needs_review' || operation === 'reopen' && live.status !== 'rejected' || operation === 'retry' && live.status !== 'approved') throw new Error('Discovery changed. Reload before continuing.')
          // Do not approve a stale Studio form while its autosave is still in flight.
          if (draft && props.draft?._rev !== draft._rev) throw new Error('Wait for your edits to finish saving, then try again.')
          const edited = draft || live
          const now = new Date().toISOString()
          const approval = operation === 'approve' ? approvalFor(edited) : undefined
          const fields = approval ? {
            approval, status: 'approved', approvedAt: now, reviewedBy: user!.id,
            reviewedTitle: approval.title, reviewedAuthors: approval.authors,
            selectionMonth: approval.selectionMonth, publicationMode: approval.mode,
            ...(approval.selectionDate ? {selectionDate: approval.selectionDate} : {}),
            ...(approval.matchedBook ? {matchedBook: approval.matchedBook} : {}),
            ...(approval.metadata ? {proposedMetadata: approval.metadata} : {}),
          } : operation === 'retry' ? {retryRequestedAt: now} : {status: operation === 'reject' ? 'rejected' : 'needs_review', reviewedBy: user!.id}
          const unset = ['processingError', ...(approval ? [
            ...(!approval.selectionDate ? ['selectionDate'] : []),
            ...(!approval.matchedBook ? ['matchedBook'] : []),
            ...(!approval.metadata ? ['proposedMetadata'] : []),
          ] : [])]
          const tx = client.transaction().patch(live._id, (p) => p.ifRevisionId(live._rev).set(fields).unset(unset))
          if (draft) tx.patch(draft._id, (p) => p.ifRevisionId(draft._rev).set({status: draft.status})).delete(draft._id)
          await tx.commit({visibility: 'sync'})
          props.onComplete()
        } catch (error) { toast.push({status: 'error', title: error instanceof Error ? error.message : 'Action failed'}) }
        finally { setBusy(false) }
      },
    }
  }
}
const actions = [action('approve'), action('reject'), action('reopen'), action('retry')]
export function bookClubWatchActions(prev: DocumentActionComponent[], context: DocumentActionsContext) {
  if (context.schemaType === 'bookClubWatchRun') return []
  if (context.schemaType !== 'bookClubDiscovery') return prev
  // The standard Publish action must never authorize catalog publication.
  return [...prev.filter((a) => a.action === 'discardChanges'), ...actions]
}
