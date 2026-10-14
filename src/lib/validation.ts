import {z} from 'zod'

export const HALF_STARS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const

export const ratingValueSchema = z
  .number()
  .refine((value) => HALF_STARS.includes(value as (typeof HALF_STARS)[number]), {
    message: 'Rating must be between 0.5 and 5 in half-star increments',
  })

export const reviewTitleSchema = z.string().trim().min(1).max(120)

export const reviewBodySchema = z.string().trim().min(1).max(8000)

export type ReviewFields = {
  title: string
  body: string
  hasSpoilers: boolean
  visibility: 'private' | 'public'
}

export const reviewVisibilitySchema = z.enum(['private', 'public'])

export const shelfKindSchema = z.enum(['wantToRead', 'currentlyReading', 'finished', 'custom'])

export const readingStatusSchema = z.enum(['wantToRead', 'currentlyReading', 'finished'])

export const partialDateSchema = z.string()
  .regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/, 'Use a year, month and year, or exact date')
  .refine((value) => {
    const complete = value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value
    const date = new Date(`${complete}T00:00:00.000Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, complete.length) === complete
  }, 'Choose a valid date read')
  .refine(
    (value) => value <= new Date().toISOString().slice(0, value.length),
    'Date read cannot be in the future',
  )

export const readingPeriodSchema = z.object({
  start: partialDateSchema.optional(),
  end: partialDateSchema,
}).strict().refine(
  ({start, end}) => {
    if (!start) return true
    const startDate = start.length === 4 ? `${start}-01-01` : start.length === 7 ? `${start}-01` : start
    const endDate = end.length === 4
      ? `${end}-12-31`
      : end.length === 7
        ? new Date(Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)), 0)).toISOString().slice(0, 10)
        : end
    return startDate <= endDate
  },
  {message: 'Reading start must be before the finish', path: ['start']},
)

export type ReadingPeriod = z.infer<typeof readingPeriodSchema>

export const shelfBookSchema = z.discriminatedUnion('source', [
  z.object({source: z.literal('catalog'), id: z.string().trim().min(1)}),
  z.object({source: z.literal('googleBooks'), id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/)}),
])

export type ShelfBook = z.infer<typeof shelfBookSchema>

export const workflowStatusSchema = z.enum(['proposed', 'needsReview', 'approved', 'rejected'])

export const spaceColorSchema = z.enum([
  'cloud',
  'blush',
  'violet',
  'clay',
  'apricot',
  'butter',
  'mint',
  'sky',
  'navy',
  'periwinkle',
  'sage',
  'peach',
  'rose',
  'lilac',
  'sand',
  'slate',
])

export const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  proposed: ['needsReview', 'rejected'],
  needsReview: ['approved', 'rejected'],
  approved: [],
  rejected: ['needsReview'],
}

export function canTransition(from: string, to: string) {
  return WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 96)
}

export function stableId(parts: string[]) {
  return parts.join('-').replace(/[^a-zA-Z0-9._-]/g, '')
}
