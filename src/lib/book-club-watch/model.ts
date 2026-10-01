import {z} from 'zod'

export const TIMEZONE = 'America/New_York'
export const CLUBS = {
  reese: {name: "Reese's Book Club", collectionId: 'curatedCollection.reeses-book-club', sourceUrl: 'https://reesesbookclub.com/the-complete-list/', schedule: '0 9 1-8 * *'},
  gma: {name: 'GMA Book Club', collectionId: 'curatedCollection.gma-book-club', sourceUrl: 'https://www.goodmorningamerica.com/news/story/shop-gma-book-club-picks-list--81520726', schedule: '0 10 * * 2'},
  'read-with-jenna': {name: 'Today / Read With Jenna', collectionId: 'curatedCollection.read-with-jenna', sourceUrl: 'https://www.today.com/shop/read-jenna-book-club-list-today-s-jenna-bush-hager-t164652', schedule: '0 9 * * 1,2'},
  oprah: {name: "Oprah's Book Club", collectionId: 'curatedCollection.oprahs-book-club', sourceUrl: 'https://www.oprahdaily.com/entertainment/books/g23067476/oprah-book-club-list/', schedule: '0 9 * * 1,3,5'},
} as const
export type Club = keyof typeof CLUBS
export type Status = 'discovered' | 'needs_review' | 'approved' | 'published' | 'rejected'
export type Pick = {title: string; authors: string[]; selectionMonth: string; selectionDate?: string; sourceUrl: string; evidence: string; isbn13?: string}
export type Metadata = {title: string; authors: string[]; description?: string; coverUrl?: string; isbn13?: string; isbn10?: string; googleBooksId?: string; publisher?: string; publishedDate?: string; pageCount?: number; language?: string}
export type Reference = {_type: 'reference'; _ref: string}
export type Approval = {title: string; authors: string[]; selectionMonth: string; selectionDate?: string; mode: 'existing' | 'new'; matchedBook?: Reference; metadata?: Metadata}
export type Discovery = {
  _id: string; _rev: string; _type: 'bookClubDiscovery'; bookClub: Club; identity: string; status: Status
  selectionMonth: string; selectionDate?: string; discoveredTitle: string; discoveredAuthor: string
  discoveredAuthors: string[]; discoveredAt: string; sourceUrl: string; sourceName: string; sourceEvidence: string
  isbn13?: string; matchedBook?: Reference; proposedMetadata?: Metadata; matchConfidence?: number; matchExplanation?: string
  reviewedTitle?: string; reviewedAuthors?: string[]; publicationMode?: 'existing' | 'new'
  approval?: Approval; approvedAt?: string; reviewedBy?: string; retryRequestedAt?: string
  processingError?: string; enrichmentError?: string; publishedBook?: Reference
}
export const reference = (_ref: string): Reference => ({_type: 'reference', _ref})
export const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function easternDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'}).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return {month: `${part('year')}-${part('month')}`, day: Number(part('day')), weekday: part('weekday')}
}
export function inWindow(club: Club, now: Date) {
  const {day, weekday} = easternDate(now)
  if (club === 'reese') return day <= 8
  if (club === 'read-with-jenna') return day <= 8 && ['Mon', 'Tue'].includes(weekday)
  return (club === 'gma' ? ['Tue'] : ['Mon', 'Wed', 'Fri']).includes(weekday)
}
const metadataSchema = z.object({
  title: z.string(), authors: z.array(z.string()), description: z.string().optional(),
  coverUrl: z.string().url().refine((url) => url.startsWith('https://')).optional(),
  isbn13: z.string().optional(), isbn10: z.string().optional(), googleBooksId: z.string().optional(),
  publisher: z.string().optional(), publishedDate: z.string().optional(), language: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
})
export function approvalFor(doc: Discovery): Approval {
  const title = (doc.reviewedTitle || doc.discoveredTitle).trim()
  const authors = (doc.reviewedAuthors || doc.discoveredAuthors || []).map((s) => s.trim()).filter(Boolean)
  if (!title || !authors.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(doc.selectionMonth)) throw new Error('Title, authors, and a valid selection month are required.')
  if (doc.selectionDate && (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(doc.selectionDate) || !doc.selectionDate.startsWith(doc.selectionMonth))) throw new Error('Selection date must match the selection month.')
  if (!doc.publicationMode) throw new Error('Choose an existing book or explicitly choose to create a new book.')
  if (doc.publicationMode === 'existing' && !doc.matchedBook?._ref) throw new Error('Choose the existing book to publish.')
  const metadata = doc.proposedMetadata ? metadataSchema.parse({...doc.proposedMetadata, title, authors}) : undefined
  return {title, authors, selectionMonth: doc.selectionMonth, mode: doc.publicationMode,
    ...(doc.selectionDate ? {selectionDate: doc.selectionDate} : {}),
    ...(doc.matchedBook ? {matchedBook: doc.matchedBook} : {}),
    ...(metadata ? {metadata} : {}),
  }
}
