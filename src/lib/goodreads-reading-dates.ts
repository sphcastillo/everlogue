type GoodreadsReadingDates = {
  status: 'finished' | 'currentlyReading' | 'wantToRead'
  addedAt?: string
  finishedAt?: string
  readCount?: number
}

export function goodreadsReadingFields(book: GoodreadsReadingDates) {
  const startedAt = book.status !== 'wantToRead' ? book.addedAt : undefined
  const period = book.status === 'finished' && book.finishedAt
    ? {
        _type: 'readingPeriod' as const,
        ...(startedAt ? {start: startedAt} : {}),
        end: book.finishedAt,
      }
    : null

  return {
    ...(startedAt ? {startedAt} : {}),
    ...(book.finishedAt ? {finishedAt: book.finishedAt} : {}),
    ...(period ? {
      readingPeriod: period,
      readingHistory: [{
        _key: `goodreads-${book.finishedAt}`,
        _type: 'readingPeriodEntry' as const,
        ...(startedAt ? {start: startedAt} : {}),
        end: book.finishedAt,
      }],
    } : {}),
    ...(book.readCount !== undefined ? {readCount: book.readCount} : {}),
  }
}
