'use client'

import {useEffect, useRef, useState, useTransition} from 'react'
import {useRouter} from 'next/navigation'

/** Keep the authenticated shell visible while a transient profile failure recovers. */
export function ReaderSetupRecovery() {
  const router = useRouter()
  const attempts = useRef(0)
  const [exhausted, setExhausted] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (pending || exhausted) return
    const timer = setTimeout(() => {
      attempts.current++
      startTransition(() => router.refresh())
      if (attempts.current >= 2) setExhausted(true)
    }, attempts.current === 0 ? 1000 : 2500)
    return () => clearTimeout(timer)
  }, [router, pending, exhausted])

  return (
    <section className="mx-auto max-w-lg px-6 py-16" aria-live="polite">
      <h1 className="text-2xl font-semibold">You’re signed in.</h1>
      <p className="mt-3 text-muted">
        {exhausted && !pending
          ? 'Your library couldn’t load just yet. Please try again in a moment.'
          : 'We’re getting your library ready. Trying again automatically…'}
      </p>
      {exhausted ? (
        <button type="button" disabled={pending} className="mt-6 rounded bg-ink px-5 py-3 text-white disabled:opacity-50"
          onClick={() => startTransition(() => router.refresh())}>
          {pending ? 'Trying again…' : 'Try again'}
        </button>
      ) : null}
    </section>
  )
}
