import type {GoodreadsBook} from './goodreads-csv'
import {catalogWorkKey} from './catalog-book-match'

export type LibraryIndexEntry = {bookId: string; hasRating: boolean}

export function libraryTitleKey(title: string, author?: string | null) {
  return catalogWorkKey(title, author)
}

export function libraryBookKeys(book: Pick<GoodreadsBook, 'title' | 'author' | 'goodreadsId' | 'isbn10' | 'isbn13'>) {
  return [
    book.goodreadsId ? `id:${book.goodreadsId}` : '',
    book.isbn13 ? `isbn13:${book.isbn13}` : '',
    book.isbn10 ? `isbn10:${book.isbn10}` : '',
    libraryTitleKey(book.title, book.author),
  ].filter(Boolean)
}

export function buildLibraryIndex(
  entries: {
    bookId?: string | null
    title?: string | null
    authors?: (string | null)[] | null
    goodreadsId?: string | null
    isbn10?: string | null
    isbn13?: string | null
    hasRating?: boolean | null
  }[],
) {
  const index = new Map<string, LibraryIndexEntry>()
  function add(key: string | undefined, bookId: string, hasRating: boolean) {
    if (!key) return
    const previous = index.get(key)
    index.set(key, {bookId, hasRating: Boolean(previous?.hasRating || hasRating)})
  }

  for (const entry of entries) {
    if (!entry.bookId || !entry.title?.trim()) continue
    const hasRating = Boolean(entry.hasRating)
    add(entry.goodreadsId ? `id:${entry.goodreadsId}` : undefined, entry.bookId, hasRating)
    add(entry.isbn13 ? `isbn13:${entry.isbn13}` : undefined, entry.bookId, hasRating)
    add(entry.isbn10 ? `isbn10:${entry.isbn10}` : undefined, entry.bookId, hasRating)
    const authors = (entry.authors ?? []).filter((author): author is string => Boolean(author?.trim()))
    if (authors.length) {
      for (const author of authors) add(libraryTitleKey(entry.title, author), entry.bookId, hasRating)
    } else {
      add(libraryTitleKey(entry.title), entry.bookId, hasRating)
    }
  }
  return index
}

export function libraryIndexFromKeys(keys: string[]) {
  return new Map(keys.map((key) => [key, {bookId: key, hasRating: false}]))
}

export function findOwnedLibraryBook(book: GoodreadsBook, index: Map<string, LibraryIndexEntry>) {
  for (const key of libraryBookKeys(book)) {
    const match = index.get(key)
    if (match) return match
  }
  return null
}

export function partitionGoodreadsBooks(books: GoodreadsBook[], index: Map<string, LibraryIndexEntry>) {
  const owned: GoodreadsBook[] = []
  const missing: GoodreadsBook[] = []
  for (const book of books) {
    if (findOwnedLibraryBook(book, index)) owned.push(book)
    else missing.push(book)
  }
  return {owned, missing}
}

