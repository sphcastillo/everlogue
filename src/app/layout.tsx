import type {Metadata} from 'next'
import {Suspense} from 'react'
import {ClerkProvider} from '@clerk/nextjs'
import {auth} from '@clerk/nextjs/server'
import {headers} from 'next/headers'
import {DM_Mono, DM_Sans, Instrument_Serif, Inter, Playfair_Display} from 'next/font/google'
import {AuthControl} from '@/components/AuthControl'
import {SignedOutRedirect} from '@/components/SignedOutRedirect'
import {getOptionalReader} from '@/lib/reader'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import {ReadingCompanion} from '@/components/ReadingCompanion'
import {ReaderSetupRecovery} from '@/components/ReaderSetupRecovery'
import Loading from './loading'
import {Analytics} from '@vercel/analytics/next'

const display = DM_Sans({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-dm-sans',
})

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
})

const accent = Playfair_Display({
  subsets: ['latin'],
  style: ['italic'],
  weight: ['400', '500'],
  variable: '--font-playfair',
})

const wordmark = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-instrument-serif',
})

const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-dm-mono',
})

export const dynamic = 'force-dynamic'

const siteTitle = 'Everlogue — Discover books, shelves, and book clubs'
const siteDescription =
  'Everlogue is a home for readers to discover books, organize their shelves, and explore their favorite book clubs.'
const ogImage = {
  url: '/images/og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'Everlogue',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://everlogue.app'),
  title: {
    default: siteTitle,
    template: '%s · Everlogue',
  },
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: 'https://everlogue.app',
    siteName: 'Everlogue',
    images: [ogImage],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [ogImage.url],
  },
}

function isImportExportPath(pathname: string) {
  return pathname === '/settings/library/import-export' || pathname === '/settings/library/import-export/'
}

async function ReaderAuthControl({signedIn}: {signedIn: boolean}) {
  const reader = await getOptionalReader().catch(() => null)
  return <AuthControl avatarSrc={reader?.avatarSrc} signedIn={signedIn} />
}

async function ReaderContent({children}: {children: React.ReactNode}) {
  const reader = await getOptionalReader().catch(() => null)
  return reader ? children : <ReaderSetupRecovery />
}

async function ReaderCompanion({signedIn}: {signedIn: boolean}) {
  const reader = await getOptionalReader().catch(() => null)
  if (signedIn && !reader) return null
  return <ReadingCompanion key={reader?.readerId || 'guest'} readerId={reader?.readerId} />
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const {isAuthenticated} = await auth()
  const pathname = (await headers()).get('x-pathname') ?? ''

  if (!isAuthenticated && isImportExportPath(pathname)) {
    const signInHref = `/sign-in?redirect_url=${encodeURIComponent('/settings/library/import-export')}`
    return (
      <html lang="en">
        <body className="bg-paper">
          <SignedOutRedirect href={signInHref} />
          <Analytics />
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${accent.variable} ${wordmark.variable} ${mono.variable} antialiased`}
        style={{fontFamily: 'var(--font-inter), ui-sans-serif, system-ui'}}
      >
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <Header auth={
            <Suspense fallback={<AuthControl signedIn={isAuthenticated} />}>
              <ReaderAuthControl signedIn={isAuthenticated} />
            </Suspense>
          } signedIn={isAuthenticated} />
          <main className="mx-auto w-full max-w-7xl">
            {isAuthenticated && pathname !== '/' ? (
              <Suspense fallback={<Loading />}>
                <ReaderContent>{children}</ReaderContent>
              </Suspense>
            ) : children}
          </main>
          <Footer signedIn={isAuthenticated} />
          <Suspense fallback={null}>
            <ReaderCompanion signedIn={isAuthenticated} />
          </Suspense>
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  )
}
