import {MAX_CSV_BYTES} from '@/lib/goodreads-csv'
import {previewGoodreadsCsv} from '@/lib/goodreads-service'
import {readerApi, readLimitedBody, RequestError} from '@/lib/reader-api'

const CSV_TYPES = new Set(['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'])

export async function POST(request: Request) {
  return readerApi(request, async (reader) => {
    const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!CSV_TYPES.has(type)) {
      throw new RequestError('Send a Goodreads CSV as text/csv.', 415, 'unsupported_media_type')
    }
    const csv = (await readLimitedBody(request, MAX_CSV_BYTES)).toString('utf8')
    return {preview: await previewGoodreadsCsv(reader.readerId, csv)}
  })
}
