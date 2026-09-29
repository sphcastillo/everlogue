import {createHash} from 'node:crypto'
import type {SanityClient} from '@sanity/client'
import {coverSrc, plainText, type GoogleBook} from './google-books'
import {searchCatalogFilter, searchCatalogParams} from './search-catalog'
import {slugify} from './validation'

export async function resolveSearchBook(client: SanityClient, book: GoogleBook, create: boolean) {
  const params = searchCatalogParams(book)
  const find = () => client.fetch<string | null>(
    `*[${searchCatalogFilter}][0]._id`, params, {cache: 'no-store'},
  )
  const existing = await find()
  if (existing || !create) return existing
  const info = book.volumeInfo
  if (!info?.title?.trim()) throw new Error('This book has no title.')
  const importedAt = new Date().toISOString()
  const coverUrl = coverSrc(book)
  const key = createHash('sha256').update(`googleBooks:${book.id}`).digest('hex')
  const tx = client.transaction()
  // Identity guards follow the catalog import pattern; book IDs remain generated
  // by Sanity. Both guards and the book are committed atomically.
  for (const identity of [`googleBooks:${book.id}`, ...(params.isbn13 ? [`isbn:${params.isbn13}`] : [])]) {
    const importKey = createHash('sha256').update(identity).digest('hex')
    tx.create({_id: `searchBookIdentity.${importKey}`, _type: 'catalogImportIdentity', importKey})
  }
  tx.create({
    _type: 'book', title: info.title.trim(), authors: info.authors || [],
    slug: {_type: 'slug', current: `${slugify(info.title).slice(0, 70)}-${key.slice(0, 12)}`},
    googleBooksId: book.id,
    catalogReviewStatus: 'needsReview', catalogSource: 'readerSearch',
    description: plainText(info.description),
    ...(info.subtitle ? {subtitle: info.subtitle} : {}),
    ...(params.isbn10 ? {isbn10: params.isbn10} : {}),
    ...(params.isbn13 ? {isbn13: params.isbn13} : {}),
    ...(coverUrl ? {cover: {url: coverUrl, source: 'googleBooks'}} : {}),
    needsCover: !coverUrl,
    ...(info.publisher ? {publisher: info.publisher} : {}),
    ...(info.publishedDate ? {publishedDate: info.publishedDate} : {}),
    ...(info.pageCount ? {pageCount: info.pageCount} : {}),
    ...(info.language ? {language: info.language} : {}),
    categories: info.categories || [],
    metadataSource: 'googleBooks', metadataImportedAt: importedAt,
  })
  try {
    await tx.commit({visibility: 'sync'})
  } catch (error) {
    if (!(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409)) throw error
  }
  const bookId = await find()
  if (!bookId) throw new Error('Unable to save this book. Please try again.')
  return bookId
}
