import type {SanityClient} from '@sanity/client'
import {useEffect, useRef, useState} from 'react'
import {useClient, type DocumentActionComponent, type DocumentActionsContext} from 'sanity'
import {useToast} from '@sanity/ui/toast'
import {lookupCatalogBook} from '../../src/lib/catalog-book-match'
import {placeCatalogImportFailure, placePendingGoodreadsImports} from '../../src/lib/goodreads-place-import'

function waitingCount(props: {draft?: Record<string, unknown> | null; published?: Record<string, unknown> | null}) {
  const doc = (props.draft || props.published || {}) as {pendingImportPlacements?: unknown[]}
  return Array.isArray(doc.pendingImportPlacements) ? doc.pendingImportPlacements.length : 0
}

function withPendingImportPlacement(PublishAction: DocumentActionComponent): DocumentActionComponent {
  const PublishWithPlacement: DocumentActionComponent = (props) => {
    const client = useClient({apiVersion: '2026-02-01'})
    const toast = useToast()
    const pendingRevision = useRef<string | null>(null)
    const action = PublishAction(props)
    useEffect(() => {
      if (pendingRevision.current === null || props.draft || !props.published || props.published._rev === pendingRevision.current) return
      pendingRevision.current = null
      const waiting = Array.isArray((props.published as {pendingImportPlacements?: unknown[]})?.pendingImportPlacements)
        ? (props.published as {pendingImportPlacements: unknown[]}).pendingImportPlacements.length
        : 0
      if (!waiting) return
      void placePendingGoodreadsImports(client as unknown as SanityClient, props.id)
        .then((result) => {
          if (result.placed) toast.push({status: 'success', title: `Added to ${result.placed === 1 ? 'a reader’s shelf' : `${result.placed} readers’ shelves`}`})
        })
        .catch((error) => toast.push({
          status: 'error',
          title: 'Book published; shelf placement needs a retry',
          description: error instanceof Error ? error.message : 'Use Add to reader’s shelf to retry.',
        }))
    }, [props.published, props.draft, props.id, client, toast])
    return action && {
      ...action,
      onHandle: () => {
        pendingRevision.current = props.published?._rev || ''
        action.onHandle?.()
      },
    }
  }
  PublishWithPlacement.action = PublishAction.action
  return PublishWithPlacement
}

const PlacePendingImportAction: DocumentActionComponent = function PlacePendingImportAction(props) {
  const client = useClient({apiVersion: '2026-02-01'})
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (props.draft || !props.published || !waitingCount(props)) return null
  return {
    label: waitingCount(props) === 1 ? 'Add to reader’s shelf' : 'Add to readers’ shelves',
    disabled: busy,
    onHandle: async () => {
      setBusy(true)
      try {
        const result = await placePendingGoodreadsImports(client as unknown as SanityClient, props.id)
        toast.push({
          status: 'success',
          title: result.placed
            ? `Added to ${result.placed === 1 ? 'the reader’s shelf' : `${result.placed} readers’ shelves`}`
            : 'No waiting readers left',
        })
        props.onComplete()
      } catch (error) {
        toast.push({status: 'error', title: error instanceof Error ? error.message : 'Could not add this book to the reader’s shelf'})
      } finally {
        setBusy(false)
      }
    },
  }
}

const LinkMatchingCatalogBook: DocumentActionComponent = function LinkMatchingCatalogBook(props) {
  const client = useClient({apiVersion: '2026-02-01'})
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const doc = props.published as {
    title?: string
    author?: string
    isbn10?: string
    isbn13?: string
    goodreadsId?: string
    book?: {_ref?: string}
    resolvedAt?: string
  } | null
  if (props.draft || !doc || doc.resolvedAt || doc.book?._ref || !doc.title || !doc.author) return null
  return {
    label: 'Use existing catalog book',
    disabled: busy,
    onHandle: async () => {
      setBusy(true)
      try {
        const match = await lookupCatalogBook(client as unknown as SanityClient, doc as {title: string; author: string})
        if (!match) {
          toast.push({status: 'warning', title: 'No matching catalog book', description: 'This looks like a new title.'})
          props.onComplete()
          return
        }
        await client.patch(props.id).set({book: {_type: 'reference', _ref: match._id}}).commit()
        toast.push({status: 'success', title: `Linked to ${match.title || 'the catalog book'}`})
        props.onComplete()
      } catch (error) {
        toast.push({status: 'error', title: error instanceof Error ? error.message : 'Could not match this title'})
      } finally {
        setBusy(false)
      }
    },
  }
}

const PlaceFailureOnShelf: DocumentActionComponent = function PlaceFailureOnShelf(props) {
  const client = useClient({apiVersion: '2026-02-01'})
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const doc = props.published as {book?: {_ref?: string}; resolvedAt?: string} | null
  if (props.draft || !doc || doc.resolvedAt || !doc.book?._ref) return null
  return {
    label: 'Add catalog book to reader’s shelf',
    disabled: busy,
    onHandle: async () => {
      setBusy(true)
      try {
        await placeCatalogImportFailure(client as unknown as SanityClient, props.id)
        toast.push({status: 'success', title: 'Added the existing catalog book to the reader’s shelf'})
        props.onComplete()
      } catch (error) {
        toast.push({status: 'error', title: error instanceof Error ? error.message : 'Could not add this book to the reader’s shelf'})
      } finally {
        setBusy(false)
      }
    },
  }
}

export function goodreadsImportActions(prev: DocumentActionComponent[], context: DocumentActionsContext) {
  if (context.schemaType === 'catalogImportFailure') return [...prev, LinkMatchingCatalogBook, PlaceFailureOnShelf]
  if (context.schemaType !== 'book') return prev
  return [
    ...prev.map((action) => action.action === 'publish' ? withPendingImportPlacement(action) : action),
    PlacePendingImportAction,
  ]
}
