import {getOptionalReader, privateHeaders} from '@/lib/reader'
import {writeClient} from '@/sanity/client'
import {ensureImportEdition} from '@/lib/import-edition'
import {resolveEditionMetadata} from '@/lib/edition-metadata'
import {editionCoverFields} from '@/sanity/queries'

export async function POST(request: Request, {params}: {params: Promise<{bookId: string}>}) {
  const headers = privateHeaders()
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return Response.json({error: 'Invalid origin'}, {status: 403, headers})
  try {
    const reader = await getOptionalReader()
    if (!reader) return Response.json({error: 'Sign in to load library covers.'}, {status: 401, headers})
    const {bookId} = await params
    const client = writeClient()
    const book = await client.fetch<{title: string; author?: string; goodreadsId?: string} | null>(
      `*[_type == "shelfEntry" && shelf->owner._ref == $readerId && book._ref == $bookId][0].book->{title, "author": authors[0], "goodreadsId": goodreadsBookId}`,
      {readerId: reader.readerId, bookId}, {cache: 'no-store'},
    )
    if (!book?.author) return Response.json({cover: null}, {headers})
    // Reuse an existing edition before making provider requests.
    let editionId = await client.fetch<string | null>(
      `*[_type == "edition" && book._ref == $bookId && !(_id in path("drafts.**"))] | order(defined(coverOverride.asset) desc, defined(cover.url) desc, defined(coverUrl) desc)[0]._id`,
      {bookId}, {cache: 'no-store'},
    )
    editionId ||= await ensureImportEdition(client, bookId, {...book, author: book.author}, resolveEditionMetadata) || null
    if (!editionId) return Response.json({cover: null}, {headers})
    const cover = await client.fetch(`*[_id == $editionId][0]{${editionCoverFields}}`, {editionId}, {cache: 'no-store'})
    return Response.json({cover}, {headers})
  } catch {
    return Response.json({error: 'Cover lookup unavailable. Please try again later.'}, {status: 503, headers})
  }
}
