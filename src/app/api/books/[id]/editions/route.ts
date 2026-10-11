import {NextRequest, NextResponse} from 'next/server'
import {getReaderBookState, lookupBookEdition, setSelectedEdition} from '@/lib/actions'
import {getBookEditions, resolveCatalogBookId} from '@/lib/book-editions'
import {getOptionalReader} from '@/lib/reader'
import {privateClient} from '@/sanity/client'

/**
 * Look up or connect a reader's copy.
 * GET lists editions. Anyone can view them. Selecting or looking up an ISBN
 * requires a signed-in reader with the book on Want to Read, Currently Reading, or Read.
 * POST { isbn } finds that ISBN only and adds the edition when it is the same work.
 * POST { editionId } or { editionId: null } sets or clears This is my copy.
 * The catalog book does not change. There is no camera scan.
 */

function editionErrorStatus(message: string) {
  if (/sign in/i.test(message)) return 401
  if (/valid isbn/i.test(message)) return 400
  if (/not in the catalog|book not found/i.test(message)) return 404
  if (/could not verify|editor can link/i.test(message)) return 422
  if (/another catalog book|reading shelf|does not belong/i.test(message)) return 409
  return 400
}

async function catalogBook(id: string) {
  const bookId = await resolveCatalogBookId(privateClient, id)
  if (!bookId) return null
  return bookId
}

export async function GET(_request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const bookId = await catalogBook((await params).id)
  if (!bookId) return NextResponse.json({error: 'Book not found.'}, {status: 404})
  const [editions, state, reader] = await Promise.all([
    getBookEditions(privateClient, bookId),
    getReaderBookState(bookId),
    getOptionalReader(),
  ])
  return NextResponse.json({
    bookId,
    editions,
    selectedId: state.editionId,
    canSelect: Boolean(reader && state.status),
  })
}

export async function POST(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const bookId = await catalogBook((await params).id)
  if (!bookId) return NextResponse.json({error: 'Book not found.'}, {status: 404})
  const reader = await getOptionalReader()
  if (!reader) return NextResponse.json({error: 'Sign in to choose an edition.'}, {status: 401})
  const state = await getReaderBookState(bookId)
  if (!state.status) {
    return NextResponse.json({error: 'Add the book to your reading shelf to select a copy or find one by ISBN.'}, {status: 409})
  }

  let body: {isbn?: unknown; editionId?: unknown}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({error: 'Send JSON with isbn or editionId.'}, {status: 400})
  }

  const hasIsbn = typeof body.isbn === 'string'
  const hasEdition = 'editionId' in body
  if (hasIsbn === hasEdition) {
    return NextResponse.json({error: 'Send isbn to find a copy, or editionId to choose or clear This is my copy.'}, {status: 400})
  }

  try {
    if (hasIsbn) {
      const result = await lookupBookEdition(bookId, body.isbn as string)
      return NextResponse.json({
        bookId,
        editionId: result.editionId,
        editions: result.editions,
        selectedId: state.editionId,
        canSelect: true,
      })
    }
    const editionId = body.editionId === null ? null : typeof body.editionId === 'string' ? body.editionId : undefined
    if (editionId === undefined) return NextResponse.json({error: 'editionId must be an edition id or null.'}, {status: 400})
    await setSelectedEdition(bookId, editionId)
    const editions = await getBookEditions(privateClient, bookId)
    return NextResponse.json({
      bookId,
      editionId,
      editions,
      selectedId: editionId,
      canSelect: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update that edition.'
    return NextResponse.json({error: message}, {status: editionErrorStatus(message)})
  }
}
