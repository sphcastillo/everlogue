import {getOptionalReader, privateHeaders} from '@/lib/reader'
import {privateClient} from '@/sanity/client'
import {csvCell} from '@/lib/goodreads-csv'

type ExportEntry = {rating?: number; title?: string; author?: string; kind: string; addedAt?: string; finishedAt?: string; readCount?: number; isbn10?: string; isbn13?: string}

export async function GET() {
  try {
    const reader = await getOptionalReader()
    if (!reader) return Response.json({error: 'Sign in to export your library.'}, {status: 401, headers: privateHeaders()})
    const entries = await privateClient.fetch<ExportEntry[]>(
      `*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["finished", "wantToRead", "currentlyReading"]] | order(addedAt desc){
        "title": book->title, "author": book->authors[0], "kind": shelf->kind, addedAt,
        "rating": *[_type == "rating" && reader._ref == $readerId && book._ref == ^.book._ref][0].value,
        "isbn10": coalesce(edition->isbn10, book->isbn10), "isbn13": coalesce(edition->isbn13, book->isbn13),
        "finishedAt": *[_type == "readingProgress" && reader._ref == $readerId && book._ref == ^.book._ref][0].finishedAt,
        "readCount": *[_type == "readingProgress" && reader._ref == $readerId && book._ref == ^.book._ref][0].readCount
      }`, {readerId: reader.readerId}, {cache: 'no-store'},
    )
    const shelves: Record<string, string> = {finished: 'read', wantToRead: 'to-read', currentlyReading: 'currently-reading'}
    const rows = [['Title', 'Author', 'Exclusive Shelf', 'Date Added', 'Date Read', 'Read Count', 'ISBN', 'ISBN13', 'My Rating'],
      ...entries.map((entry) => [entry.title, entry.author, shelves[entry.kind], entry.addedAt?.slice(0, 10), entry.finishedAt, entry.readCount, entry.isbn10, entry.isbn13, entry.rating ?? 0])]
    return new Response('\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), {
      headers: {...privateHeaders(), 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="everlogue-library.csv"', 'X-Content-Type-Options': 'nosniff'},
    })
  } catch (error) {
    console.error('Library export failed:', error)
    return Response.json({error: 'Unable to export your library. Please try again.'}, {status: 500, headers: privateHeaders()})
  }
}
