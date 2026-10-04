'use client'

import {useEffect, useRef, useState} from 'react'
import {CompanionMessageText} from './CompanionMessageText'

const STARTERS = [
  {label: 'What should I read next?', message: 'What should I read next?'},
  {label: 'Show me my current reads', message: 'Show me my current reads'},
]

type ChatMessage = {
  _key?: string
  role: 'user' | 'assistant'
  text: string
  createdAt?: string
}
const MAX_SAVED_MESSAGES = 40

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('role' in item) ||
      !('text' in item) ||
      (item.role !== 'user' && item.role !== 'assistant') ||
      typeof item.text !== 'string' ||
      !item.text.trim()
    ) return []
    return [{
      role: item.role,
      text: item.text,
      ...('_key' in item && typeof item._key === 'string' ? {_key: item._key} : {}),
      ...(
        'createdAt' in item &&
        typeof item.createdAt === 'string' &&
        Number.isFinite(Date.parse(item.createdAt))
          ? {createdAt: item.createdAt}
          : {}
      ),
    }]
  }).slice(-MAX_SAVED_MESSAGES)
}

export function ReadingCompanion({readerId}: {readerId?: string}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(!readerId)
  const [error, setError] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const savedHistory = useRef('[]')

  useEffect(() => {
    if (!readerId) return
    let cancelled = false

    void fetch('/api/companion/history', {cache: 'no-store'})
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load companion history.')
        const data = await response.json() as {messages?: unknown}
        if (!cancelled) {
          const parsed = parseMessages(data.messages)
          savedHistory.current = JSON.stringify(parsed)
          setMessages(parsed)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Your saved conversation could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [readerId])

  useEffect(() => {
    if (!readerId || !historyLoaded) return
    const savableMessages =
      pending && messages.at(-1)?.role === 'assistant' ? messages.slice(0, -1) : messages
    const completeMessages = savableMessages
      .filter(message => message.text.trim())
      .slice(-MAX_SAVED_MESSAGES)
    const snapshot = JSON.stringify(completeMessages)
    if (snapshot === savedHistory.current) return

    const timer = window.setTimeout(() => {
      void fetch('/api/companion/history', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({messages: completeMessages}),
      }).then(response => {
        if (response.ok) savedHistory.current = snapshot
      }).catch(() => {})
    }, 400)
    return () => window.clearTimeout(timer)
  }, [historyLoaded, messages, pending, readerId])

  useEffect(() => {
    function clearHistory() {
      savedHistory.current = '[]'
      setMessages([])
      setError('')
    }
    window.addEventListener('everlogue:companion-history-cleared', clearHistory)
    return () => window.removeEventListener('everlogue:companion-history-cleared', clearHistory)
  }, [])

  useEffect(() => {
    if (!open) return
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
    if (!message || pending || !historyLoaded) return
    setDraft('')
    setError('')
    setPending(true)
    setMessages((current) => [
      ...current,
      {role: 'user', text: message, createdAt: new Date().toISOString()},
    ])
    try {
      const response = await fetch('/api/companion', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message, history: messages.filter(item => item.text).slice(-12)}),
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null) as {error?: string} | null
        throw new Error(data?.error || 'The companion could not answer.')
      }
      setMessages(current => [
        ...current,
        {role: 'assistant', text: '', createdAt: new Date().toISOString()},
      ])
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', complete = false
      try {
        while (true) {
          const {value, done} = await reader.read()
          buffer += decoder.decode(value, {stream: !done})
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            const event = JSON.parse(line) as {type: string; text?: string; error?: string}
            if (event.type === 'error') throw new Error(event.error || 'The companion could not finish its answer.')
            if (event.type === 'done') complete = true
            if (event.type === 'text' && event.text) {
              setMessages(current => current.map((item, index) => index === current.length - 1 ? {...item, text: item.text + event.text} : item))
            }
          }
          if (done) break
        }
        if (!complete) throw new Error('The answer was interrupted. Please try again.')
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The companion could not answer.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:gap-3">
      {open ? (
        <section
          className="pointer-events-auto flex max-h-[min(36rem,calc(100dvh-5.5rem))] w-full flex-col overflow-hidden border bg-[#f6f1ea] shadow-[0_24px_50px_rgba(17,17,17,0.18)] border-[#e3d8cc]! sm:max-h-[min(36rem,calc(100dvh-7rem))] sm:w-[min(calc(100vw-3rem),26rem)]"
          aria-label="Everlogue reading companion"
        >
          <header className="flex items-start justify-between gap-3 border-b px-4 pt-3.5 pb-3.5 border-[#eadfd3]! sm:gap-4 sm:px-5 sm:pt-4 sm:pb-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-(--palette-clay) uppercase">
                Everlogue · Reading companion
              </p>
              <h2 className="mt-1.5 font-display text-[1.28rem] leading-none font-black tracking-[-0.04em] sm:mt-2 sm:text-[1.65rem]">
                A thought between pages
              </h2>
              <p className="mt-1.5 hidden text-sm leading-6 text-muted sm:mt-2 sm:block">
                Ask about your books, your next read, or where to begin.
              </p>
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

          <div ref={log} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:min-h-48 sm:px-5 sm:py-5">
            {messages.length ? (
              <ul className="space-y-4">
                {messages.map((item, index) => (
                  <li key={`${item.role}-${index}`} className={item.role === 'user' ? 'text-right' : ''}>
                    <p
                      className={`inline-block max-w-[95%] whitespace-pre-wrap wrap-break-word px-3 py-2 text-left text-sm leading-6 ${
                        item.role === 'user' ? 'bg-ink text-white' : 'border bg-paper border-[#eadfd3]!'
                      }`}
                    >
                      {item.role === 'assistant' ? <CompanionMessageText text={item.text} /> : item.text}
                    </p>
                  </li>
                ))}
                {pending ? <li className="text-sm text-muted">Thinking…</li> : null}
              </ul>
            ) : (
              <div className="flex h-full min-h-36 flex-col justify-end sm:min-h-44">
                <div className="border bg-paper px-4 py-4 border-[#eadfd3]! sm:px-5 sm:py-5">
                  <p className="font-accent text-[1.05rem] leading-snug text-ink italic sm:text-[1.2rem]">
                    “What would you like to find in a book?”
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted sm:mt-3">
                    I can help you find a title in your library, choose your next read, or explore the stories behind the books.
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap">
                  {STARTERS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={!historyLoaded}
                      className="border bg-paper px-3 py-2.5 text-left text-sm border-[#d6d6d6]! hover:bg-white disabled:opacity-50 sm:py-2"
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
            className="border-t px-4 pt-3 pb-3 border-[#eadfd3]! sm:px-5 sm:pt-4"
            onSubmit={(event) => {
              event.preventDefault()
              void send(draft)
            }}
          >
            <label className="relative block">
              <span className="sr-only">Ask your reading companion</span>
              <textarea
                rows={1}
                value={draft}
                disabled={pending || !historyLoaded}
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                placeholder="Ask your reading companion..."
                className="min-h-12 w-full resize-none border bg-paper py-3 pr-14 pl-3 text-[16px] leading-6 border-(--palette-clay)! placeholder:text-muted sm:text-sm"
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
                disabled={pending || !historyLoaded || !draft.trim()}
                className="absolute top-1.5 right-1.5 grid size-9 place-items-center bg-[#c4b8a8] text-ink disabled:opacity-40"
                aria-label="Send"
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
                  <path d="M8 12V4M5 7l3-3 3 3" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            </label>
            {error ? <p className="mt-2 text-sm text-(--palette-clay)">{error}</p> : null}
            <p className="mt-2 hidden text-[11px] text-muted sm:block">Enter to send · Shift + Enter for a new line</p>
          </form>
        </section>
      ) : null}

      {open ? (
        <button
          type="button"
          aria-expanded={true}
          className="pointer-events-auto hidden h-11 items-center gap-2.5 self-end bg-[#3f352c] px-4 font-mono text-[11px] font-medium tracking-[0.16em] text-[#f6f1ea] uppercase sm:inline-flex"
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
          className="pointer-events-auto inline-flex h-11 items-center gap-2.5 self-end bg-[#3f352c] px-4 font-mono text-[11px] font-medium tracking-[0.16em] text-[#f6f1ea] uppercase"
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
