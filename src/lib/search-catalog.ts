import {type GoogleBook} from './google-books'
import {isbn13For} from './edition-metadata'

export const searchCatalogFilter = `_type == "book" && !(_id in path("drafts.**")) && (
  googleBooksId == $id || ($isbn13 != "" && isbn13 == $isbn13) || ($isbn10 != "" && isbn10 == $isbn10) ||
  _id in *[_type == "edition" && !(_id in path("drafts.**")) && (
    googleBooksId == $id || ($isbn13 != "" && isbn13 == $isbn13) || ($isbn10 != "" && isbn10 == $isbn10)
  )].book._ref
)`

export function searchCatalogParams(book: GoogleBook) {
  const identifiers = book.volumeInfo?.industryIdentifiers || []
  const isbn10 = identifiers.find((item) => item.type === 'ISBN_10')?.identifier || ''
  const isbn13 = identifiers.find((item) => item.type === 'ISBN_13')?.identifier || (isbn10 ? isbn13For(isbn10) : '')
  return {id: book.id, isbn10, isbn13}
}
