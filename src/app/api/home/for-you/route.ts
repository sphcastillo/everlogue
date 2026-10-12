import {getForYouHomeShelf} from '@/lib/home-shelves'
import {getOptionalReader, privateHeaders} from '@/lib/reader'

export async function GET() {
  const headers = privateHeaders()
  try {
    // Clerk middleware verifies cookie and mobile Bearer session tokens.
    const reader = await getOptionalReader()
    if (!reader) {
      return Response.json({error: 'Sign in to see your recommendations.'}, {status: 401, headers})
    }
    return Response.json(await getForYouHomeShelf(reader.readerId), {headers})
  } catch (error) {
    console.error('Unable to load personalized home shelf:', error)
    return Response.json({error: 'Unable to load recommendations. Please try again.'}, {status: 503, headers})
  }
}
