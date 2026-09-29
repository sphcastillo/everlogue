import {NextResponse} from 'next/server'
import {getMyBooks} from '@/lib/actions'
import {getOptionalReader} from '@/lib/reader'
import {companionReply, type CompanionShelf} from '@/lib/reading-companion'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {message?: string} | null
  const message = body?.message?.trim() ?? ''
  if (!message || message.length > 2000) {
    return NextResponse.json({error: 'Ask something short about your reading.'}, {status: 400})
  }

  let shelves: CompanionShelf[] = []
  const reader = await getOptionalReader().catch(() => null)
  if (reader) {
    try {
      const library = await getMyBooks()
      shelves = (library as {shelves?: CompanionShelf[]})?.shelves || []
    } catch {
      shelves = []
    }
  }

  return NextResponse.json({reply: companionReply(message, shelves)})
}
