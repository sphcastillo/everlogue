export const PENDING_CATALOG_REVIEW =
  '(!defined(catalogReviewStatus) || catalogReviewStatus == "needsReview")'

export const FROM_READER_SEARCH = 'catalogSource == "readerSearch"'

export const FROM_GOODREADS =
  '(catalogSource == "goodreadsImport" || (!defined(catalogSource) && defined(importKey)))'

export const FROM_BOOK_CLUB = `(
  catalogSource == "bookClubImport"
  || string::startsWith(_id, "book.google.")
  || count(*[_type == "curatedCollection" && count(books[book._ref == ^._id]) > 0]) > 0
  || count(*[_type == "celebritySelection" && count(books[_ref == ^._id]) > 0]) > 0
)`

export const BOOKCLUB_IMPORTS_FILTER = `_type == "book" && ${PENDING_CATALOG_REVIEW} && ${FROM_BOOK_CLUB}`
