'use client'

import {useRouter} from 'next/navigation'

export function BackButton() {
  const router = useRouter()

  function goBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/my-books')
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.16em] uppercase"
    >
      <span aria-hidden="true">←</span>
      Back
    </button>
  )
}
