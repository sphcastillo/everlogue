import {MOOD_QUESTION, shouldAskMoodQuestion} from '@/lib/companion-catalog'
import {NextResponse} from 'next/server'
import {getMyBooks} from '@/lib/actions'
import {getOptionalReader} from '@/lib/reader'
import {type CompanionShelf} from '@/lib/reading-companion'
import {companionConfigured, companionRequest, companionResponse} from '@/lib/companion-agent'
import {writeClient} from '@/sanity/client'
import {CompanionLimitError, reserveCompanionUsage, type CompanionUsage} from '@/lib/companion-usage'

export const runtime = 'nodejs'
export const maxDuration = 120

async function boundedInput(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 32000) { await reader.cancel(); throw new Error('Request too large') }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { reader.releaseLock() }
}

export async function POST(request: Request) {
  const input = companionRequest.safeParse(await boundedInput(request).catch(() => null))
  if (!input.success) return NextResponse.json({error: 'Ask something short about your reading.'}, {status: 400})
  if (shouldAskMoodQuestion(input.data.message, input.data.history)) {
    return new Response(JSON.stringify({type: 'text', text: MOOD_QUESTION}) + '\n' + JSON.stringify({type: 'done'}) + '\n', {headers: {'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'private, no-store'}})
  }
  if (!companionConfigured()) return NextResponse.json({error: 'The reading companion is not configured yet.'}, {status: 503})

  let readerId: string | null = null
  let libraryUnavailable = false
  let shelfContext = 'Not signed in; personal reading history is unavailable.'
  let reader
  try { reader = await getOptionalReader() }
  catch { return NextResponse.json({error: 'Unable to check your account. Please try again.'}, {status: 503}) }
  try {
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

  let usage: CompanionUsage
  try {
    usage = await reserveCompanionUsage(writeClient(), readerId, process.env.SANITY_API_WRITE_TOKEN!)
  } catch (error) {
    if (error instanceof CompanionLimitError) return NextResponse.json({error: error.message}, {
      status: 429, headers: {'Retry-After': String(error.retryAfter), 'Cache-Control': 'private, no-store'},
    })
    return NextResponse.json({error: 'The companion is temporarily unavailable. Please try again shortly.'}, {status: 503})
  }
  try {
    const response = await companionResponse(input.data, request.signal, shelfContext, readerId, libraryUnavailable, usage)
    response.headers.set('X-Companion-Request-Id', usage.id)
    return response
  }
  catch {
    await usage.finish(request.signal.aborted ? 'cancelled' : 'failed')
    return NextResponse.json({error: 'The reading companion could not connect. Please try again.'}, {status: 502})
  }
}
