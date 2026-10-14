import 'server-only'
import {z} from 'zod'
import {revalidatePath} from 'next/cache'
import {privateClient, writeClient} from '@/sanity/client'
import {reportCatalogImportFailure, resolveCatalogImportFailure} from './catalog-import-failure'
import {goodreadsBookSchema, IMPORT_BATCH_SIZE, parseGoodreadsCsv} from './goodreads-csv'
import {AmbiguousCatalogMatchError, ensureGoodreadsCatalogBook, importGoodreadsBook, type ImportResult} from './goodreads-import'
import {buildLibraryIndex, libraryBookKeys, partitionGoodreadsBooks, summarizeGoodreadsPreview} from './goodreads-library'
import {resolveEditionMetadata} from './edition-metadata'
import {ReaderDataError} from './reader-data-error'
import type {ReaderSession} from './reader'

export async function loadReaderLibraryIndex(readerId: string) {
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

export async function previewGoodreadsCsv(readerId: string, csv: string) {
  let preview
  try {
    preview = parseGoodreadsCsv(csv)
  } catch (error) {
    throw new ReaderDataError(error instanceof Error ? error.message : 'This file is not a valid Goodreads CSV.', 400, 'invalid_request')
  }
  const {owned, missing} = partitionGoodreadsBooks(preview.books, await loadReaderLibraryIndex(readerId))
  return {
    ...summarizeGoodreadsPreview(preview, owned, missing),
    issues: preview.issues,
    owned: owned.map((book) => ({row: book.row, title: book.title, status: book.status})),
    books: missing,
  }
}

export async function importGoodreadsBooks(reader: ReaderSession, input: unknown): Promise<ImportResult[]> {
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
      if (error instanceof AmbiguousCatalogMatchError) {
        results.push({row: book.row, title: book.title, status: 'failed', message: error.message})
        continue
      }
      console.error('Goodreads book import failed:', error)
      let bookId: string | undefined
      try {
        bookId = await ensureGoodreadsCatalogBook(client, book)
      } catch (ensureError) {
        if (ensureError instanceof AmbiguousCatalogMatchError) {
          results.push({row: book.row, title: book.title, status: 'failed', message: ensureError.message})
          continue
        }
        console.error('Could not open a catalog book for the failed import:', ensureError)
      }
      await reportCatalogImportFailure(client, reader, book, error, bookId).catch((reportError) => {
        console.error('Could not record the import failure:', reportError)
      })
      results.push({row: book.row, title: book.title, status: 'failed', message: 'Could not save this book. You can retry this title.'})
    }
  }
  revalidatePath('/my-shelves')
  revalidatePath('/books/[slug]', 'page')
  return results
}
