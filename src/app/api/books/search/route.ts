import {auth} from '@clerk/nextjs/server'
import {NextRequest, NextResponse} from 'next/server'
import {searchGoogleBooks} from '@/lib/google-books-api'

export async function GET(request: NextRequest) {
  const {isAuthenticated} = await auth()
  if (!isAuthenticated) {
    return NextResponse.json({error: 'Sign in to search books.'}, {status: 401})
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (query.length < 2 || query.length > 200) {
    return NextResponse.json({error: 'Search query is required'}, {status: 400})
  }

  try {
    const data = await searchGoogleBooks(query)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'Book search is not configured.') {
      return NextResponse.json({error: error.message}, {status: 503})
    }
    const status = error instanceof Error && 'status' in error ? Number(error.status) : 502
    if (status === 502 || Number.isNaN(status)) {
      return NextResponse.json({error: 'Google Books could not be reached.'}, {status: 502})
    }
    if (status === 503 || status === 504) {
      return NextResponse.json(
        {error: 'Book search is temporarily unavailable. Please try again shortly.'},
        {status},
      )
    }
    if (status === 429) {
      return NextResponse.json(
        {error: 'Book search is temporarily rate limited. Please try again shortly.'},
        {status},
      )
    }
    return NextResponse.json({error: 'Google Books request failed'}, {status})
  }
}
