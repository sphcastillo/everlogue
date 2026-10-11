'use client'

import {useState, useTransition} from 'react'
import {useRouter} from 'next/navigation'
import {lookupEditionAction, saveEditionAction} from '@/lib/server-actions'
import type {BookEdition} from '@/lib/book-editions'
import {BookCover} from './BookCover'

const FORMAT_LABELS: Record<string, string> = {
  hardcover: 'Hardcover',
  paperback: 'Paperback',
  ebook: 'Ebook',
  audiobook: 'Audiobook',
  other: 'Other',
}

function formatLabel(format?: string) {
  if (!format) return null
  return FORMAT_LABELS[format] || format.charAt(0).toUpperCase() + format.slice(1)
}

function kindAndPages(edition: BookEdition) {
  const kind = formatLabel(edition.format)
  const pages = edition.pageCount ? `${edition.pageCount} pages` : null
  return [kind, pages].filter(Boolean).join(' · ') || null
}

export function BookEditions({bookId, editions: initialEditions, selectedId, canSelect}: {
  bookId: string; editions: BookEdition[]; selectedId: string | null; canSelect: boolean
}) {
  const [editions, setEditions] = useState(initialEditions)
  const [isbn, setIsbn] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function select(editionId: string | null) {
    setMessage('')
    startTransition(async () => {
      const result = await saveEditionAction(bookId, editionId)
      if ('error' in result) setMessage(result.error || 'Could not save your edition.')
      else { setMessage(editionId ? 'This copy is now attached to the book on your shelf.' : 'This book no longer has a copy attached.'); router.refresh() }
    })
  }

  const selected = editions.find((edition) => edition._id === selectedId)
  const selectedKind = selected ? formatLabel(selected.format) : null
  const summaryNote = selected
    ? selectedKind ? `Your shelf copy · ${selectedKind}` : 'Your shelf copy'
    : editions.length
      ? `${editions.length} ${editions.length === 1 ? 'edition' : 'editions'}`
      : null

  return (
    <section className="mt-8 border-t border-(--line) pt-6">
      <details>
        <summary className="cursor-pointer list-outside marker:text-muted">
          <h2 className="font-display inline text-2xl font-bold">Editions &amp; publishing history</h2>
          {summaryNote ? <span className="ml-2 text-sm font-normal text-muted"> {summaryNote}</span> : null}
        </summary>
      <p className="mt-2 text-sm text-muted">
        {selected
          ? 'The copy marked On your shelf is the edition attached to this book in your library. Choose a different listing to change it.'
          : 'These listings are published copies of the same book. Attach one to this title on your shelf if you want to keep track of the edition you have.'}
      </p>
      {!canSelect ? <p className="mt-2 text-sm text-muted">Add the book to a reading shelf to attach a copy, or find one by ISBN after it is on your shelf.</p> : (
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(event) => {
          event.preventDefault()
          setMessage('')
          startTransition(async () => {
            const result = await lookupEditionAction(bookId, isbn)
            if ('error' in result) setMessage(result.error || 'Could not find that edition.')
            else { setEditions(result.editions); setMessage('Edition found. Check the details below, then choose your copy.') }
          })
        }}>
          <label className="flex flex-col gap-1 text-sm">Find your copy by ISBN
            <input value={isbn} onChange={(event) => setIsbn(event.target.value)} maxLength={32} required placeholder="ISBN-10 or ISBN-13" className="border border-(--line) bg-paper px-3 py-2" />
          </label>
          <button disabled={pending} className="border border-(--line) px-4 py-2 text-sm disabled:opacity-50">{pending ? 'Please wait…' : 'Find edition'}</button>
          {selectedId ? <button type="button" disabled={pending} onClick={() => select(null)} className="px-2 py-2 text-sm underline">Detach this copy</button> : null}
        </form>
      )}
      <p role="status" className="mt-3 text-sm">{message}</p>
      {!editions.length ? <p className="text-sm text-muted">No editions recorded yet. We add them as readers look up their copies.</p> : (
        <ul className="mt-3 space-y-4">
          {editions.map((edition) => {
            const onShelf = selectedId === edition._id
            const facts = [edition.publisher, edition.publicationDate].filter(Boolean).join(' · ')
            const extras = [edition.language, edition.editionStatement].filter(Boolean).join(' · ')
            const kindRow = kindAndPages(edition)
            return (
            <li key={edition._id} className={`flex gap-4 border p-4 ${onShelf ? 'border-ink bg-(--palette-cloud)/40' : 'border-(--line)'}`}>
              <BookCover cover={edition.cover} title={edition.title || 'Edition'} className="aspect-2/3 w-16 shrink-0 self-start" imageWidth={128} sizes="64px" />
              <div className="min-w-0 flex-1 text-sm">
                {onShelf ? <p className="mb-2 font-mono text-[10px] font-medium tracking-[0.14em] text-ink uppercase">On your shelf</p> : null}
                <p className="font-semibold">{facts || 'Edition details not yet available'}</p>
                {edition.title ? <p>{edition.title}</p> : null}
                {extras ? <p className="text-muted">{extras}</p> : null}
                {edition.translators?.length ? <p>Translated by {edition.translators.join(', ')}</p> : null}
                <p className="mt-1 font-mono text-xs">{edition.isbn13 || edition.isbn10 ? `ISBN ${edition.isbn13 || edition.isbn10}` : 'ISBN not recorded'}</p>
                {kindRow ? <p className="mt-1">{kindRow}</p> : null}
                {canSelect && onShelf ? (
                  <p className="mt-3 text-sm text-muted">This is the copy attached to this book on your shelf. Pick another listing to change it.</p>
                ) : null}
                {canSelect && !onShelf ? (
                  <button type="button" disabled={pending} onClick={() => select(edition._id)} className="mt-3 underline">Use this copy</button>
                ) : null}
              </div>
            </li>
            )
          })}
        </ul>
      )}
      </details>
    </section>
  )
}
