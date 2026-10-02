import type {SanityClient} from '@sanity/client'
import {CLUBS, approvalFor, normalize, reference, type Discovery} from './model'
import {conflict, findBook, hash, safeError} from './service'
import {slugify} from '../validation'

const fresh = {useCdn: false}
async function resolveApprovedBook(client: SanityClient, doc: Discovery) {
  const approved = doc.approval!
  if (approved.mode === 'existing') {
    const id = approved.matchedBook?._ref
    const exists = id && await client.fetch<boolean>('count(*[_type == "book" && _id == $id && !(_id in path("drafts.**"))]) == 1', {id}, fresh)
    if (!exists) throw new Error('Publication selected book is missing or unpublished.')
    return id!
  }
  const existing = await findBook(client, approved.title, approved.authors, approved.metadata)
  if (existing) return existing._id
  const identity = hash([normalize(approved.title), ...approved.authors.map(normalize).sort()].join('\n'))
  const find = () => client.fetch<string | null>(' *[_type == "book" && watchIdentity == $identity && !(_id in path("drafts.**"))][0]._id', {identity}, fresh)
  const previous = await find()
  if (previous) return previous
  const metadata = approved.metadata || {title: approved.title, authors: approved.authors}
  const {coverUrl, title: _title, authors: _authors, ...fields} = metadata
  void _title; void _authors
  try {
    await client.transaction()
      .create({_id: `bookClubWatchBookIdentity.${identity}`, _type: 'catalogImportIdentity', importKey: identity})
      .create({_type: 'book', ...fields, title: approved.title, authors: approved.authors,
        slug: {_type: 'slug', current: `${slugify(approved.title).slice(0, 70)}-${identity.slice(0, 12)}`},
        watchIdentity: identity, watchDiscovery: reference(doc._id), catalogSource: 'bookClubImport', catalogReviewStatus: 'reviewed',
        ...(coverUrl ? {cover: {url: coverUrl, source: 'googleBooks'}} : {}),
      }).commit({visibility: 'sync'})
  } catch (error) { if (!conflict(error)) throw error }
  const id = await find()
  if (!id) throw new Error('Publication could not resolve the approved book.')
  return id
}
export async function publishDiscovery(client: SanityClient, id: string) {
  if (id.startsWith('drafts.')) return
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await client.fetch<Discovery | null>('*[_type == "bookClubDiscovery" && _id == $id][0]', {id}, fresh)
    if (!doc || doc.status !== 'approved' || 'catalogBook' in doc) return
    try {
      if (!doc.approval || !doc.approvedAt || !doc.reviewedBy) throw new Error('Publication requires an explicit editorial approval snapshot.')
      // Validate the frozen snapshot again; mutable discovery fields are never published.
      doc.approval = approvalFor({...doc, proposedMetadata: doc.approval.metadata, reviewedTitle: doc.approval.title, reviewedAuthors: doc.approval.authors, selectionMonth: doc.approval.selectionMonth, selectionDate: doc.approval.selectionDate, publicationMode: doc.approval.mode, matchedBook: doc.approval.matchedBook})
      const collectionId = CLUBS[doc.bookClub].collectionId
      const collection = await client.fetch<{_id: string; _rev: string; books?: {_key: string; book?: {_ref: string}; selectionNumber?: number}[]} | null>('*[_id == $id][0]{_id,_rev,books}', {id: collectionId}, fresh)
      if (!collection) throw new Error('Publication club collection is missing; create it before retrying.')
      const bookId = await resolveApprovedBook(client, doc)
      const books = collection.books || []
      const exists = books.some((item) => item.book?._ref === bookId || item._key === `watch-${doc.identity}`)
      const next = exists ? books : [...books, {
        _key: `watch-${doc.identity}`, _type: 'curatedCollectionEntry', book: reference(bookId),
        selectionNumber: Math.max(0, ...books.map((b) => b.selectionNumber || 0)) + 1,
        selectionDate: doc.approval.selectionDate || doc.approval.selectionMonth,
        year: Number(doc.approval.selectionMonth.slice(0, 4)),
        month: new Intl.DateTimeFormat('en-US', {month: 'long', timeZone: 'UTC'}).format(new Date(`${doc.approval.selectionMonth}-15T12:00:00Z`)),
      }]
      await client.transaction()
        .patch(collectionId, (p) => p.ifRevisionId(collection._rev).set({books: next, totalSelections: next.length, lastSyncedAt: new Date().toISOString()}))
        .patch(doc._id, (p) => p.ifRevisionId(doc._rev).set({status: 'published', publishedBook: reference(bookId), publishedAt: new Date().toISOString()}).unset(['processingError']))
        .commit({visibility: 'sync'})
      return
    } catch (error) {
      if (conflict(error) && attempt < 3) continue
      try { await client.patch(doc._id).ifRevisionId(doc._rev).set({processingError: safeError(error)}).commit({visibility: 'sync'}) }
      catch (patchError) { if (!conflict(patchError)) throw patchError }
      throw new Error(safeError(error))
    }
  }
}
