import {clerkMiddleware} from '@clerk/nextjs/server'
import {NextResponse} from 'next/server'

// Resources enforce authentication themselves; the proxy supplies Clerk context.
export default clerkMiddleware((_auth, request) => {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({request: {headers: requestHeaders}})
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
