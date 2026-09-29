'use client'

import {useEffect, useRef, useState} from 'react'
import {BookCover, type CoverSource} from './BookCover'
import {coverCandidates, hasManualCover} from '@/lib/book-covers'

// Bound client requests so a long shelf doesn't start hundreds of lookups.
let queue = Promise.resolve()
const requests = new Map<string, Promise<CoverSource | null>>()
function lookup(bookId: string) {
  const existing = requests.get(bookId)
  if (existing) return existing
  const result = queue.then(async () => {
    const response = await fetch(`/api/library/covers/${encodeURIComponent(bookId)}`, {method: 'POST'})
    if (!response.ok) throw new Error('Cover lookup failed')
    return (await response.json()).cover as CoverSource | null
  })
  requests.set(bookId, result)
  queue = result.then(() => {}, () => { requests.delete(bookId) })
  return result
}

export function LibraryBookCover({
  bookId,
  cover,
  title,
  className,
  imageWidth,
  sizes,
}: {
  bookId: string
  cover?: CoverSource | null
  title: string
  className: string
  imageWidth?: number
  sizes?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const [resolved, setResolved] = useState<CoverSource | null>(null)
  const missing = !hasManualCover(cover) && !coverCandidates(cover).length
  useEffect(() => {
    if (!missing || !root.current) return
    let cancelled = false
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      void lookup(bookId).then((value) => { if (!cancelled) setResolved(value) }).catch(() => {})
    }, {rootMargin: '200px'})
    observer.observe(root.current)
    return () => { cancelled = true; observer.disconnect() }
  }, [bookId, missing])
  return (
    <div ref={root}>
      <BookCover cover={missing ? resolved || cover : cover} title={title} className={className} imageWidth={imageWidth} sizes={sizes} />
    </div>
  )
}
