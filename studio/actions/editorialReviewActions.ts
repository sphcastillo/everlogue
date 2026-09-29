import {type DocumentActionComponent, type DocumentActionsContext, useDocumentOperation} from 'sanity'

const REVIEWABLE = new Set(['celebritySelection', 'editorialCollection'])

const ALLOWED: Record<string, string[]> = {
  proposed: ['needsReview', 'rejected'],
  needsReview: ['approved', 'rejected'],
  approved: [],
  rejected: ['needsReview'],
}

function currentStatus(props: {draft?: Record<string, unknown> | null; published?: Record<string, unknown> | null}) {
  const doc = (props.draft || props.published || {}) as Record<string, unknown>
  if (typeof doc.workflowStatus === 'string') return doc.workflowStatus
  return 'proposed'
}

const approveAction: DocumentActionComponent = (props) => {
  const {patch} = useDocumentOperation(props.id, props.type)
  const status = currentStatus(props)
  const field = 'workflowStatus'
  if (!ALLOWED[status]?.includes('approved')) return null
  return {
    label: 'Approve',
    onHandle: () => {
      patch.execute([
        {
          set: {
            [field]: 'approved',
            reviewedAt: new Date().toISOString(),
          },
        },
      ])
      props.onComplete()
    },
  }
}

const needsReviewAction: DocumentActionComponent = (props) => {
  const {patch} = useDocumentOperation(props.id, props.type)
  const status = currentStatus(props)
  const field = 'workflowStatus'
  if (!ALLOWED[status]?.includes('needsReview')) return null
  return {
    label: 'Send to review',
    onHandle: () => {
      patch.execute([{set: {[field]: 'needsReview'}}])
      props.onComplete()
    },
  }
}

const rejectAction: DocumentActionComponent = (props) => {
  const {patch} = useDocumentOperation(props.id, props.type)
  const status = currentStatus(props)
  const field = 'workflowStatus'
  if (!ALLOWED[status]?.includes('rejected')) return null
  return {
    label: 'Reject',
    tone: 'critical',
    onHandle: () => {
      patch.execute([
        {
          set: {
            [field]: 'rejected',
            reviewedAt: new Date().toISOString(),
          },
        },
      ])
      props.onComplete()
    },
  }
}

export function editorialReviewActions(
  prev: DocumentActionComponent[],
  context: DocumentActionsContext,
) {
  if (!REVIEWABLE.has(context.schemaType)) return prev
  return [...prev, needsReviewAction, approveAction, rejectAction]
}
