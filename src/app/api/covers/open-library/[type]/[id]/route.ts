import {normalizeIsbn} from '@/lib/isbn'

const COVER_TYPES = new Set(['id', 'isbn', 'olid'])
const FALLBACKS = new Set(['1.png', '2.png', '3.png', '4.png', '5.png'])
const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400'

export async function GET(
  request: Request,
  {params}: {params: Promise<{type: string; id: string}>},
) {
  const {type, id: rawId} = await params
  const id = type === 'isbn' ? normalizeIsbn(rawId) : rawId
  if (!COVER_TYPES.has(type) || !id || !/^[A-Za-z0-9]+$/.test(id)) {
    return new Response('Invalid cover identifier', {status: 400})
  }

  const fallback = new URL(request.url).searchParams.get('fallback') || '1.png'
  const fallbackFile = FALLBACKS.has(fallback) ? fallback : '1.png'
  const fallbackUrl = new URL(`/images/cover-placeholders/${fallbackFile}`, request.url)

  try {
    const response = await fetch(
      `https://covers.openlibrary.org/b/${type}/${encodeURIComponent(id)}-L.jpg?default=false`,
      {cache: 'no-store'},
    )
    if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('image/')) {
      return Response.redirect(fallbackUrl, 307)
    }
    return new Response(response.body, {
      headers: {
        'Cache-Control': CACHE_CONTROL,
        'Content-Type': response.headers.get('content-type')!,
      },
    })
  } catch {
    return Response.redirect(fallbackUrl, 307)
  }
}
