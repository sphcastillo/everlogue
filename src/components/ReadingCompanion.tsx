'use client'

import {useEffect, useRef, useState} from 'react'

const STARTERS = [
  {label: 'What should I read next?', message: 'What should I read next?'},
  {label: 'Show me my current reads', message: 'Show me my current reads'},
]

type ChatMessage = {role: 'user' | 'assistant'; text: string}

export function ReadingCompanion() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    log.current?.scrollTo({top: log.current.scrollHeight})
  }, [messages, open])

  async function send(text: string) {
    const message = text.trim()
    if (!message || pending) return
    setDraft('')
    setError('')
    setPending(true)
    setMessages((current) => [...current, {role: 'user', text: message}])
    try {
      const response = await fetch('/api/companion', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message}),
      })
      const data = (await response.json().catch(() => null)) as {reply?: string; error?: string} | null
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error || 'The companion could not answer.')
      }
      setMessages((current) => [...current, {role: 'assistant', text: data.reply!}])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The companion could not answer.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open ? (
        <section
          className="pointer-events-auto flex max-h-[min(36rem,calc(100vh-7rem))] w-[min(calc(100vw-2rem),26rem)] flex-col border bg-[#f6f1ea] shadow-[0_24px_50px_rgba(17,17,17,0.18)] border-[#e3d8cc]!"
          aria-label="Everlogue reading companion"
        >
          <header className="flex items-start justify-between gap-4 border-b px-5 pt-4 pb-4 border-[#eadfd3]!">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-(--palette-clay) uppercase">
                Everlogue · Reading companion
              </p>
              <h2 className="mt-2 font-display text-[1.65rem] leading-none font-black tracking-[-0.04em]">
                A thought between pages
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">Ask about your books, your next read, or where to begin.</p>
            </div>
            <button
              type="button"
              className="grid size-9 shrink-0 place-items-center border text-ink border-[#d6d6d6]!"
              aria-label="Close companion"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </header>

          <div ref={log} className="min-h-48 flex-1 overflow-y-auto px-5 py-5">
            {messages.length ? (
              <ul className="space-y-4">
                {messages.map((item, index) => (
                  <li key={`${item.role}-${index}`} className={item.role === 'user' ? 'text-right' : ''}>
                    <p
                      className={`inline-block max-w-[95%] px-3 py-2 text-left text-sm leading-6 ${
                        item.role === 'user' ? 'bg-ink text-white' : 'border bg-paper border-[#eadfd3]!'
                      }`}
                    >
                      {item.text}
                    </p>
                  </li>
                ))}
                {pending ? <li className="text-sm text-muted">Thinking…</li> : null}
              </ul>
            ) : (
              <div className="flex h-full min-h-44 flex-col justify-end">
                <div className="border bg-paper px-5 py-5 border-[#eadfd3]!">
                  <p className="font-accent text-[1.2rem] leading-snug text-ink italic">
                    “What would you like to find in a book?”
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    I can help you find a title in your library, choose your next read, or keep your shelf in order.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {STARTERS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="border bg-paper px-3 py-2 text-left text-sm border-[#d6d6d6]! hover:bg-white"
                      onClick={() => void send(item.message)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            className="border-t px-5 pt-4 pb-3 border-[#eadfd3]!"
            onSubmit={(event) => {
              event.preventDefault()
              void send(draft)
            }}
          >
            <label className="relative block">
              <span className="sr-only">Ask your reading companion</span>
              <textarea
                ref={input}
                rows={1}
                value={draft}
                disabled={pending}
                placeholder="Ask your reading companion..."
                className="min-h-12 w-full resize-none border bg-paper py-3 pr-14 pl-3 text-sm leading-6 border-(--palette-clay)! placeholder:text-muted"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send(draft)
                  }
                }}
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                className="absolute top-1.5 right-1.5 grid size-9 place-items-center bg-[#c4b8a8] text-ink disabled:opacity-40"
                aria-label="Send"
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
                  <path d="M8 12V4M5 7l3-3 3 3" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            </label>
            {error ? <p className="mt-2 text-sm text-(--palette-clay)">{error}</p> : null}
            <p className="mt-2 text-[11px] text-muted">Enter to send · Shift + Enter for a new line</p>
          </form>
        </section>
      ) : null}

      {open ? (
        <button
          type="button"
          aria-expanded={true}
          className="pointer-events-auto inline-flex h-11 items-center gap-2.5 bg-[#3f352c] px-4 font-mono text-[11px] font-medium tracking-[0.16em] text-[#f6f1ea] uppercase"
          onClick={() => setOpen(false)}
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
            <path d="M3.5 6.5 8 11l4.5-4.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          Keep reading
        </button>
      ) : (
        <button
          type="button"
          aria-expanded={false}
          className="pointer-events-auto inline-flex h-11 items-center gap-2.5 bg-[#3f352c] px-4 font-mono text-[11px] font-medium tracking-[0.16em] text-[#f6f1ea] uppercase"
          onClick={() => setOpen(true)}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
            <path d="M3 3.5h6.5A2.5 2.5 0 0 1 12 6v7H5.2A2.2 2.2 0 0 0 3 15.2V3.5Z" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6.2 3.5V15" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Ask Everlogue
        </button>
      )}
    </div>
  )
}
