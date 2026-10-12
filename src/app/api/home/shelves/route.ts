import {getPublicHomeShelves} from '@/lib/home-shelves'

export async function GET() {
  try {
    // Sanity catalog reads use the shared 120-second data cache.
    return Response.json({tabs: await getPublicHomeShelves()}, {
      headers: {'Cache-Control': 'no-store'},
    })
  } catch (error) {
    console.error('Unable to load public home shelves:', error)
    return Response.json({error: 'Unable to load shelves. Please try again.'}, {
      status: 503, headers: {'Cache-Control': 'no-store'},
    })
  }
}
