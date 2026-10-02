import type {SanityClient} from '@sanity/client'
import {CLUBS, reference, type Discovery} from './model'

type CatalogDiscovery = Discovery & {catalogBook?: {_ref: string}; catalogBaselineRevision?: string}
const fresh = {perspective: 'raw' as const, useCdn: false}

// Only an editor opening the catalog import creates a draft. Discovery itself stays read-only.
export async function openCatalogImport(client: SanityClient, discoveryId: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await client.fetch<CatalogDiscovery>('*[_id == $id][0]', {id: discoveryId}, fresh)
    if (!doc || !['needs_review', 'discovered'].includes(doc.status)) throw new Error('This discovery is no longer awaiting review.')
    if (doc.catalogBook?._ref) return doc.catalogBook._ref
    const existing = doc.matchedBook?._ref && await client.fetch<{_id: string; _rev: string; _type: string}>('*[_type == "book" && _id == $id][0]', {id: doc.matchedBook._ref}, fresh)
    const id = existing ? existing._id : crypto.randomUUID()
    const metadata = doc.proposedMetadata || {title: doc.discoveredTitle, authors: doc.discoveredAuthors}
    const {coverUrl, ...fields} = metadata
    const tx = client.transaction().patch(doc._id, p => p.ifRevisionId(doc._rev).set({catalogBook: {...reference(id), _weak: true}, ...(existing ? {catalogBaselineRevision: existing._rev} : {})}))
    if (existing) {
      const draft = await client.fetch<{_rev: string} | null>('*[_id == $id][0]', {id: `drafts.${id}`}, fresh)
      if (draft) tx.patch(`drafts.${id}`, p => p.ifRevisionId(draft._rev).set({watchDiscovery: reference(doc._id)}))
      else {
        const {_rev, ...fields} = existing
        void _rev
        tx.create({...fields, _id: `drafts.${id}`, watchDiscovery: reference(doc._id)})
      }
    }
    if (!existing) tx.create({_id: `drafts.${id}`, _type: 'book', ...fields,
      title: doc.discoveredTitle, authors: doc.discoveredAuthors, catalogSource: 'bookClubImport', catalogReviewStatus: 'needsReview',
      watchDiscovery: reference(doc._id), ...(coverUrl ? {cover: {url: coverUrl, source: 'googleBooks'}} : {}),
      knowledgeSources: [{_key: crypto.randomUUID(), _type: 'knowledgeSource', label: doc.sourceName, url: doc.sourceUrl}],
    })
    try { await tx.commit({visibility: 'sync'}); return id }
    catch (error) { if ((error as {statusCode?: number}).statusCode !== 409 || attempt === 3) throw error }
  }
  throw new Error('Discovery changed. Please try again.')
}

// Called only after the regular book Publish has succeeded. Never creates or edits book metadata.
export async function completeCatalogReview(client: SanityClient, bookId: string, reviewer: string) {
  if (bookId.startsWith('drafts.')) return
  for (let attempt = 0; attempt < 4; attempt++) {
    const discoveries = await client.fetch<CatalogDiscovery[]>('*[_type == "bookClubDiscovery" && catalogBook._ref == $id && status in ["needs_review", "discovered"] && !(_id in path("drafts.**"))]', {id: bookId}, fresh)
    if (!discoveries.length) return
    const book = await client.fetch<{_id: string; _rev: string} | null>('*[_type == "book" && _id == $id][0]{_id,_rev}', {id: bookId}, fresh)
    if (!book) throw new Error('Publish the catalog book before completing Watch review.')
    try {
      for (const doc of discoveries) {
        if (doc.catalogBaselineRevision === book._rev) throw new Error('Publish the reviewed catalog book before completing Watch review.')
        const config = CLUBS[doc.bookClub]
        const slug = config.collectionId.replace(/^curatedCollection\./, '')
        const matches = await client.fetch<{_id: string; _rev: string; books?: {_key: string; book?: {_ref: string}; selectionNumber?: number}[]}[]>('*[_type == "curatedCollection" && (_id == $id || slug.current == $slug) && !(_id in path("drafts.**"))]{_id,_rev,books}', {id: config.collectionId, slug}, fresh)
        if (matches.length > 1) throw new Error('Multiple collections match this club. Resolve the duplicate collections before finishing Watch review.')
        const collection = matches[0]
        const collectionId = collection?._id || config.collectionId
        const books = collection?.books || []
        const next = books.some(entry => entry.book?._ref === bookId || entry._key === `watch-${doc.identity}`) ? books : [...books, {
          _key: `watch-${doc.identity}`, _type: 'curatedCollectionEntry', book: reference(bookId),
          selectionNumber: Math.max(0, ...books.map(entry => entry.selectionNumber || 0)) + 1,
          selectionDate: doc.selectionDate || doc.selectionMonth, year: Number(doc.selectionMonth.slice(0, 4)),
          month: new Intl.DateTimeFormat('en-US', {month: 'long', timeZone: 'UTC'}).format(new Date(`${doc.selectionMonth}-15T12:00:00Z`)),
        }]
        const now = new Date().toISOString()
        const tx = client.transaction()
        if (collection) tx.patch(collectionId, p => p.ifRevisionId(collection._rev).set({books: next, totalSelections: next.length, lastSyncedAt: now}))
        // The importer-owned club ID guards concurrent first selections in an empty dataset.
        // Creation and approval commit together; a retry reads the winning collection.
        else tx.create({_id: collectionId, _type: 'curatedCollection', title: config.name,
          slug: {_type: 'slug', current: slug}, collectionType: 'celebrityBookClub',
          source: {name: config.name, url: config.sourceUrl}, books: next,
          totalSelections: next.length, lastSyncedAt: now,
        })
        await tx
          .patch(doc._id, p => p.ifRevisionId(doc._rev).set({status: 'approved', approvedAt: now, publishedAt: now, reviewedBy: reviewer, publishedBook: reference(bookId)}).unset(['processingError', 'approval']))
          .commit({visibility: 'sync'})
      }
      return
    } catch (error) {
      if ((error as {statusCode?: number}).statusCode === 409 && attempt < 3) continue
      for (const doc of discoveries) {
        await client.patch(doc._id).ifRevisionId(doc._rev).set({processingError: 'Catalog publication succeeded, but Watch could not finish. Use Finish Watch review on the published book to retry; check Studio permissions and any duplicate club collections.'}).commit().catch(() => {})
      }
      throw error
    }
  }
}
