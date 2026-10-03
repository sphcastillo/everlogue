import {MOOD_QUESTION, shouldAskMoodQuestion} from '@/lib/companion-catalog'
import {NextResponse} from 'next/server'
import {getMyBooks} from '@/lib/actions'
import {getOptionalReader} from '@/lib/reader'
import {type CompanionShelf} from '@/lib/reading-companion'
import {companionConfigured, companionRequest, companionResponse} from '@/lib/companion-agent'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  const input = companionRequest.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({error: 'Ask something short about your reading.'}, {status: 400})
  if (shouldAskMoodQuestion(input.data.message, input.data.history)) {
    return new Response(JSON.stringify({type: 'text', text: MOOD_QUESTION}) + '\n' + JSON.stringify({type: 'done'}) + '\n', {headers: {'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'private, no-store'}})
  }
  if (!companionConfigured()) return NextResponse.json({error: 'The reading companion is not configured yet.'}, {status: 503})

  let readerId: string | null = null
  let libraryUnavailable = false
  let shelfContext = 'Not signed in; personal reading history is unavailable.'
  try {
    const reader = await getOptionalReader()
    if (reader) {
      readerId = reader.readerId
      const library = await getMyBooks()
      const shelves = (library as {shelves?: CompanionShelf[]})?.shelves || []
      shelfContext = JSON.stringify(shelves.map(shelf => ({
        kind: shelf.kind, name: shelf.name,
        books: (shelf.entries || []).slice(0, 30).flatMap(entry => entry.book?.title ? [{title: entry.book.title, authors: entry.book.authors}] : []),
        truncated: (shelf.entries?.length || 0) > 30,
      })))
    }
  } catch { libraryUnavailable = true; shelfContext = 'Personal library could not be loaded. Do not assume it is empty.' }

  try { return await companionResponse(input.data, request.signal, shelfContext, readerId, libraryUnavailable) }
  catch { return NextResponse.json({error: 'The reading companion could not connect. Please try again.'}, {status: 502}) }
}
