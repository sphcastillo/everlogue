'use server'

import {z} from 'zod'
import {revalidatePath} from 'next/cache'
import {privateClient, writeClient} from '@/sanity/client'
import {requireReader} from './reader'
import {goodreadsBookSchema, IMPORT_BATCH_SIZE} from './goodreads-csv'
import {reportCatalogImportFailure, resolveCatalogImportFailure} from './catalog-import-failure'
import {importGoodreadsBook, type ImportResult} from './goodreads-import'
import {resolveEditionMetadata} from './edition-metadata'
import {buildLibraryIndex, libraryBookKeys} from './goodreads-library'

async function loadReaderLibraryIndex(readerId: string) {
  const entries = await privateClient.fetch<{
    bookId?: string | null
    title?: string | null
    authors?: (string | null)[] | null
    goodreadsId?: string | null
    isbn10?: string | null
    isbn13?: string | null
    hasRating?: boolean | null
  }[]>(
    `*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["finished", "currentlyReading", "wantToRead"] && defined(book->title)]{
      "bookId": book._ref,
      "title": book->title,
      "authors": book->authors,
      "goodreadsId": book->goodreadsBookId,
      "isbn10": book->isbn10,
      "isbn13": book->isbn13,
      "hasRating": count(*[_type == "rating" && reader._ref == $readerId && book._ref == ^.book._ref]) > 0
    }`,
    {readerId},
    {cache: 'no-store'},
  )
  return buildLibraryIndex(entries)
}

export async function getReaderLibraryIndex() {
  const reader = await requireReader()
  const index = await loadReaderLibraryIndex(reader.readerId)
  return {keys: [...index.keys()]}
}

export async function importGoodreadsBatch(input: unknown): Promise<ImportResult[]> {
  const reader = await requireReader()
  const books = z.array(goodreadsBookSchema).min(1).max(IMPORT_BATCH_SIZE).parse(input)
  const client = writeClient()
  const library = await loadReaderLibraryIndex(reader.readerId)
  const results: ImportResult[] = []
  for (const book of books) {
    if (libraryBookKeys(book).some((key) => library.has(key))) {
      results.push({
        row: book.row,
        title: book.title,
        status: 'skipped',
        message: 'Already in your library; kept your existing shelf, dates, and rating.',
      })
      continue
    }
    try {
      const result = await importGoodreadsBook(client, reader.readerId, book, resolveEditionMetadata)
      await resolveCatalogImportFailure(client, reader.readerId, book).catch(() => {})
      results.push(result)
      if (result.status !== 'failed') {
        for (const key of libraryBookKeys(book)) {
          library.set(key, {bookId: book.goodreadsId || book.title, hasRating: book.rating !== undefined})
        }
      }
    } catch (error) {
      console.error('Goodreads book import failed:', error)
      await reportCatalogImportFailure(client, reader, book, error).catch((reportError) => {
        console.error('Could not record the import failure:', reportError)
      })
      results.push({row: book.row, title: book.title, status: 'failed', message: 'Could not save this book. You can retry this title.'})
    }
  }
  revalidatePath('/my-books')
  revalidatePath('/books/[slug]', 'page')
  return results
}
