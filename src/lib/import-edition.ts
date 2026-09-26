import {createHash} from 'node:crypto'
import type {SanityClient} from '@sanity/client'
import {isbn13For, type EditionInput, type EditionMetadata} from './edition-metadata'

export async function ensureImportEdition(client: SanityClient, bookId: string, input: EditionInput, resolve: (input: EditionInput) => Promise<EditionMetadata>) {
  const isbn = input.isbn13 || (input.isbn10 ? isbn13For(input.isbn10) : '')
  let importKey = createHash('sha256').update(isbn || `goodreads:${input.goodreadsId || bookId}`).digest('hex')
  const params = {bookId, importKey, isbn, isbn10: input.isbn10 || ''}
  const find = () => client.fetch<{_id: string; bookId: string; editorialLocked?: boolean; coverOverride?: unknown; cover?: {url?: string}; coverUrl?: string; coverOpenLibraryId?: string; needsCover?: boolean; coverCheckedAt?: string} | null>(
    `*[_type == "edition" && !(_id in path("drafts.**")) && (importKey == $importKey || ($isbn != "" && isbn13 == $isbn) || ($isbn10 != "" && isbn10 == $isbn10))][0]{_id, "bookId": book._ref, editorialLocked, coverOverride, cover, coverUrl, coverOpenLibraryId, needsCover, coverCheckedAt}`,
    params, {cache: 'no-store'},
  )
  const existing = await find()
  // ISBNs identify editions globally. Never attach a different book's edition.
  if (existing) {
    if (existing.bookId !== bookId) return undefined
    const missing = !existing.cover?.url && !existing.coverUrl && !existing.coverOpenLibraryId
    if ((existing.needsCover || missing) && !existing.editorialLocked && !existing.coverOverride && (!existing.coverCheckedAt || Date.now() - Date.parse(existing.coverCheckedAt) > 86400000)) {
      const metadata = await resolve(input)
      await client.patch(existing._id).setIfMissing(Object.fromEntries(Object.entries(metadata).filter(([key, value]) => key !== 'needsCover' && value !== undefined)))
        .set({needsCover: metadata.needsCover, coverCheckedAt: new Date().toISOString()}).commit()
    }
    return existing._id
  }
  const metadata = await resolve(input)
  const resolvedIsbn = metadata.isbn13 || (metadata.isbn10 ? isbn13For(metadata.isbn10) : '')
  if (resolvedIsbn && resolvedIsbn !== isbn) {
    importKey = createHash('sha256').update(resolvedIsbn).digest('hex')
    Object.assign(params, {importKey, isbn: resolvedIsbn, isbn10: metadata.isbn10 || ''})
    const matched = await find()
    if (matched) return matched.bookId === bookId ? matched._id : undefined
  }
  const fields = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined))
  try {
    await client.transaction()
      .create({_id: `editionImportIdentity.${importKey}`, _type: 'catalogImportIdentity', importKey})
      .create({_type: 'edition', importKey, title: input.title, book: {_type: 'reference', _ref: bookId}, coverCheckedAt: new Date().toISOString(), ...fields})
      .commit({visibility: 'sync'})
  } catch (error) {
    if (!(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409)) throw error
  }
  return (await find())?._id
}
