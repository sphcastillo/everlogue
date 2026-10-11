import {catalogWorkKey} from './catalog-book-match'

export function editionTitleAuthorMismatch(
  editionTitle: string | undefined,
  providerAuthors: string[] | undefined,
  bookTitle: string | undefined,
  bookAuthors: string[] | null | undefined,
) {
  if (!editionTitle || !bookTitle || !bookAuthors?.length) return false
  const authors = providerAuthors?.length ? providerAuthors : bookAuthors
  return !authors.some((author) =>
    bookAuthors.some((name) => catalogWorkKey(editionTitle, author) === catalogWorkKey(bookTitle, name)),
  )
}
