export const IMPORT_TITLE_RETRIES = 2

export const LIBRARIAN_HANDOFF =
  'The Everlogue librarian will take care of this one. It will be added to your shelf in the next 1–2 days.'

export function importRetriesExhausted(retries: number) {
  return retries >= IMPORT_TITLE_RETRIES
}

export type ImportReportCounts = {
  imported: number
  updated: number
  skipped: number
  failed: number
}

export function importReportNews(counts: ImportReportCounts) {
  const added = counts.imported + counts.updated
  const books = (count: number, singular = 'book', plural = 'books') =>
    `${count} ${count === 1 ? singular : plural}`

  if (counts.failed === 0 && added > 0) {
    const already = counts.skipped
      ? ` ${books(counts.skipped, 'title was', 'titles were')} already on your shelves.`
      : ''
    if (!counts.imported) {
      return {
        tone: 'success' as const,
        headline: counts.updated === 1 ? 'Good news — we filled a rating.' : 'Good news — we filled missing ratings.',
        body: `We added ${books(counts.updated, 'missing rating', 'missing ratings')} to books already on your shelves.${already}`,
      }
    }
    return {
      tone: 'success' as const,
      headline: counts.imported === 1 ? 'Good news — your book is in.' : 'Good news — your books are in.',
      body: `${books(counts.imported, 'book is', 'books are')} on your shelves now.${
        counts.updated ? ` We also filled ${books(counts.updated, 'missing rating', 'missing ratings')}.` : ''
      }${already}`,
    }
  }

  if (counts.failed === 0) {
    return {
      tone: 'current' as const,
      headline: 'You’re already caught up.',
      body: counts.skipped
        ? `Every title in this file was already in your library. Nothing new to add.`
        : 'There were no books left to import from this file.',
    }
  }

  if (added > 0) {
    return {
      tone: 'mixed' as const,
      headline: 'Here’s the report.',
      body: `${books(counts.imported)} landed on your shelves.${
        counts.updated ? ` ${books(counts.updated, 'missing rating was', 'missing ratings were')} filled.` : ''
      } ${books(counts.failed, 'title', 'titles')} didn’t save this time.`,
    }
  }

  return {
    tone: 'failed' as const,
    headline: 'These titles didn’t save.',
    body: 'Nothing new landed on your shelves yet. Retry a title below, or leave it with us.',
  }
}
