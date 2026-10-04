import type {Metadata} from 'next'
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

export const metadata: Metadata = {
  title: {
    default: 'Everlogue',
    template: '%s · Everlogue',
  },
  description: 'A home for everything you read.',
}

function isImportExportPath(pathname: string) {
  return pathname === '/settings/library/import-export' || pathname === '/settings/library/import-export/'
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
        </body>
      </html>
    )
  }

  // A Sanity setup failure must not turn a valid Clerk session into a failed
  // root layout (or a guest session). Resource-level auth remains unchanged.
  const reader = await getOptionalReader().catch(() => null)
  const readerUnavailable = isAuthenticated && !reader

  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${accent.variable} ${wordmark.variable} ${mono.variable} antialiased`}
        style={{fontFamily: 'var(--font-inter), ui-sans-serif, system-ui'}}
      >
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <Header auth={<AuthControl avatarSrc={reader?.avatarSrc} signedIn={isAuthenticated} />} signedIn={isAuthenticated} />
          <main className="mx-auto w-full max-w-7xl">
            {readerUnavailable ? <ReaderSetupRecovery /> : children}
          </main>
          <Footer signedIn={isAuthenticated} />
          {!readerUnavailable ? <ReadingCompanion key={reader?.readerId || 'guest'} readerId={reader?.readerId} /> : null}
        </ClerkProvider>
      </body>
    </html>
  )
}
