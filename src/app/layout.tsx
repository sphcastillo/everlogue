import type {Metadata} from 'next'
import {ClerkProvider} from '@clerk/nextjs'
import {DM_Mono, DM_Sans, Instrument_Serif, Inter, Playfair_Display} from 'next/font/google'
import {AuthControl} from '@/components/AuthControl'
import {getOptionalReader} from '@/lib/reader'
import './globals.css'
import Header from '@/components/Header'
import {ReadingCompanion} from '@/components/ReadingCompanion'

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

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const reader = await getOptionalReader()

  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${accent.variable} ${wordmark.variable} ${mono.variable} antialiased`}
        style={{fontFamily: 'var(--font-inter), ui-sans-serif, system-ui'}}
      >
        <ClerkProvider>
          <div className="mx-auto w-full max-w-7xl">
            <Header auth={<AuthControl />} signedIn={Boolean(reader)} />
            {children}
          </div>
          <ReadingCompanion />
        </ClerkProvider>
      </body>
    </html>
  )
}
