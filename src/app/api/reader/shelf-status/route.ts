import {setShelfStatus} from '@/lib/actions'
import {readerApi, readReaderJson, shelfStatusRequest} from '@/lib/reader-api'

export async function PUT(request: Request) {
  return readerApi(request, async () => {
    const {book, status, readingPeriod, appendRead} = shelfStatusRequest.parse(await readReaderJson(request))
    const bookId = await setShelfStatus(book, status, readingPeriod, appendRead)
    return {ok: true, bookId, status}
  })
}
