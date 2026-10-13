import {getMyBooks} from '@/lib/actions'
import {readerApi} from '@/lib/reader-api'

export async function GET(request: Request) {
  return readerApi(request, async () => ({library: await getMyBooks()}))
}
