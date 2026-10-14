import {importGoodreadsBooks} from '@/lib/goodreads-service'
import {readerApi, readReaderJson, RequestError} from '@/lib/reader-api'

const IMPORT_JSON_BYTES = 32 * 1024

export async function POST(request: Request) {
  return readerApi(request, async (reader) => {
    const body = await readReaderJson(request, IMPORT_JSON_BYTES)
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('books' in body)) {
      throw new RequestError('Send {books: [...]}.', 400, 'invalid_request')
    }
    return {results: await importGoodreadsBooks(reader, (body as {books: unknown}).books)}
  })
}
