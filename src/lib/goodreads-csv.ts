import {z} from 'zod'
import {ratingValueSchema} from './validation'

export const MAX_CSV_BYTES = 10 * 1024 * 1024
export const MAX_IMPORT_ROWS = 10000
export const IMPORT_BATCH_SIZE = 3
export const SHELF_LABELS = {finished: 'Read', wantToRead: 'Want To Read', currentlyReading: 'Currently Reading'} as const
const shelfMap: Record<string, keyof typeof SHELF_LABELS> = {
  read: 'finished', 'to-read': 'wantToRead', 'currently-reading': 'currentlyReading',
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
})

export const goodreadsBookSchema = z.object({
  row: z.number().int().positive(),
  goodreadsId: z.string().regex(/^\d{1,20}$/).optional(),
  title: z.string().trim().min(1).max(1000),
  author: z.string().trim().min(1).max(500),
  isbn10: z.string().regex(/^\d{9}[\dX]$/).optional(),
  isbn13: z.string().regex(/^\d{13}$/).optional(),
  status: z.enum(['finished', 'wantToRead', 'currentlyReading']),
  rating: ratingValueSchema.optional(),
  addedAt: dateSchema.optional(),
  finishedAt: dateSchema.optional(),
  readCount: z.number().int().min(0).max(100000).optional(),
  publicationYear: z.number().int().min(1000).max(2100).optional(),
}).superRefine((book, context) => {
  if (book.addedAt && book.finishedAt && book.addedAt > book.finishedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['addedAt'],
      message: 'Date Added must not be after Date Read',
    })
  }
})
export type GoodreadsBook = z.infer<typeof goodreadsBookSchema>
export type ImportIssue = {row: number; title: string; message: string}
export type GoodreadsPreview = {books: GoodreadsBook[]; issues: ImportIssue[]; total: number}

// RFC 4180-style parsing, including quoted newlines, escaped quotes, CRLF and BOM.
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closed = false
  function cell() { row.push(field); field = ''; closed = false }
  function line() {
    cell()
    if (row.some((value) => value.trim())) rows.push(row)
    row = []
    if (rows.length > MAX_IMPORT_ROWS + 1) throw new Error('Please upload at most 10,000 books at a time.')
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { quoted = false; closed = true }
      } else field += char
    } else if (char === ',') cell()
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      line()
    } else if (char === '"' && !field && !closed) quoted = true
    else {
      if (closed || char === '"') throw new Error('This CSV has invalid quotation marks. Please upload the original Goodreads export.')
      field += char
    }
  }
  if (quoted) throw new Error('This CSV has an unfinished quoted field. Please export it again from Goodreads.')
  if (field || row.length || closed) line()
  return rows
}

function cleanIsbn(value: string) {
  return value.replace(/^="(.*)"$/, '$1').replace(/[\s-]/g, '').toUpperCase()
}

function parseDate(value: string) {
  if (!value) return undefined
  const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (!match) throw new Error('Invalid reading date. Use YYYY/MM/DD or YYYY-MM-DD.')
  const result = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  if (!dateSchema.safeParse(result).success) throw new Error('Invalid reading date.')
  return result
}

export function parseGoodreadsCsv(text: string): GoodreadsPreview {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw new Error('Please upload a CSV smaller than 10 MB.')
  const [headers, ...rows] = parseCsv(text)
  if (!headers) throw new Error('This file is empty.')
  const normalized = headers.map((header) => header.trim().toLowerCase())
  if (new Set(normalized).size !== normalized.length) throw new Error('The CSV has duplicate column names.')
  for (const name of ['title', 'author', 'exclusive shelf']) {
    if (!normalized.includes(name)) throw new Error(`Missing Goodreads column: ${name}. Upload your Goodreads library export.`)
  }
  if (!rows.length) throw new Error('This CSV contains no books.')
  const books: GoodreadsBook[] = [], issues: ImportIssue[] = []
  const seen = new Set<string>()
  rows.forEach((values, index) => {
    const row = index + 2
    const get = (name: string) => (values[normalized.indexOf(name)] || '').trim()
    const title = get('title')
    try {
      if (values.length !== headers.length) throw new Error('The number of columns does not match the CSV header.')
      const status = shelfMap[get('exclusive shelf').toLowerCase()]
      if (!status) throw new Error(`Unsupported shelf: ${get('exclusive shelf') || '(empty)'}.`)
      const isbn10 = cleanIsbn(get('isbn')), isbn13 = cleanIsbn(get('isbn13'))
      const year = Number(get('original publication year') || get('year published'))
      const rating = ratingValueSchema.safeParse(Number(get('my rating')))
      if (get('my rating') && Number(get('my rating')) !== 0 && !rating.success) {
        throw new Error('Invalid My Rating value. Use 0 for unrated or 0.5–5 in half-star increments.')
      }
      const book = goodreadsBookSchema.parse({
        row, title, author: get('author'), status,
        goodreadsId: get('book id') || undefined,
        isbn10: /^\d{9}[\dX]$/.test(isbn10) ? isbn10 : undefined,
        isbn13: /^\d{13}$/.test(isbn13) ? isbn13 : undefined,
        ...(rating.success ? {rating: rating.data} : {}),
        addedAt: parseDate(get('date added')),
        finishedAt: parseDate(get('date read')),
        readCount: get('read count') ? Number(get('read count')) : undefined,
        publicationYear: Number.isInteger(year) && year >= 1000 && year <= 2100 ? year : undefined,
      })
      const key = book.goodreadsId || book.isbn13 || book.isbn10 || `${title.toLowerCase()}|${book.author.toLowerCase()}`
      if (seen.has(key)) throw new Error('Duplicate book in this CSV.')
      seen.add(key)
      books.push(book)
    } catch (error) {
      issues.push({
        row,
        title,
        message: error instanceof z.ZodError
          ? error.issues[0]?.message || 'Invalid or missing book details.'
          : (error as Error).message,
      })
    }
  })
  return {books, issues, total: rows.length}
}

export function csvCell(value: string | number | undefined) {
  let text = String(value ?? '')
  // Prevent exported book titles/authors from being interpreted as spreadsheet formulas.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
