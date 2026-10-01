'use client'

import {useState} from 'react'

export function ReviewSpoiler({
  title,
  children,
}: {
  title?: string
  children: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      {open ? (
        <ReviewCopy title={title} body={children} />
      ) : (
        <p className="text-sm text-muted">This review has spoilers.</p>
      )}
      <button
        type="button"
        className="mt-2 font-mono text-[11px] font-medium tracking-[0.14em] text-muted uppercase hover:text-ink"
        onClick={() => setOpen(!open)}
      >
        {open ? 'Hide spoilers' : 'Show spoilers'}
      </button>
    </div>
  )
}

export function ReviewCopy({title, body}: {title?: string; body: string}) {
  return (
    <div>
      {title ? <h3 className="font-medium">{title}</h3> : null}
      <p className={`whitespace-pre-wrap text-[0.95rem] leading-relaxed${title ? ' mt-2' : ''}`}>{body}</p>
    </div>
  )
}
