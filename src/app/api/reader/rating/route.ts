import {setRating} from '@/lib/actions'
import {readerApi, readReaderJson, ratingRequest} from '@/lib/reader-api'

export async function PUT(request: Request) {
  return readerApi(request, async () => {
    const {bookId, value} = ratingRequest.parse(await readReaderJson(request))
    await setRating(bookId, value)
    return {ok: true, bookId, value}
  })
}
