'use client'

import Link from 'next/link'
import {useEffect, useRef, useState, type DragEvent, type RefObject} from 'react'
import {getReaderLibraryIndex, importGoodreadsBatch} from '@/lib/goodreads-actions'
import {IMPORT_BATCH_SIZE, MAX_CSV_BYTES, parseGoodreadsCsv, SHELF_LABELS, type GoodreadsBook, type GoodreadsPreview} from '@/lib/goodreads-csv'
import {libraryIndexFromKeys, partitionGoodreadsBooks} from '@/lib/goodreads-library'
import type {ImportResult} from '@/lib/goodreads-import'
import {importReportNews, importRetriesExhausted, LIBRARIAN_HANDOFF} from '@/lib/goodreads-report'

function skippedOwned(book: {row: number; title: string}): ImportResult {
  return {
    row: book.row,
    title: book.title,
    status: 'skipped',
    message: 'Already in your library; kept your existing shelf, dates, and rating.',
  }
}

export function GoodreadsImport() {
  const [preview, setPreview] = useState<GoodreadsPreview | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [complete, setComplete] = useState(false)
  const [retryingRow, setRetryingRow] = useState<number | null>(null)
  const [libraryKeys, setLibraryKeys] = useState<string[] | null>(null)
  const [retryAttempts, setRetryAttempts] = useState<Record<number, number>>({})
  const running = useRef(false)
  const selection = useRef(0)
  const dragDepth = useRef(0)
  const reportRef = useRef<HTMLElement>(null)
  const uploadDisabled = busy || reading

  async function selectFile(file?: File) {
    if (!file || uploadDisabled || running.current) return
    const version = ++selection.current
    setPreview(null); setResults([]); setError(''); setComplete(false); setLibraryKeys(null); setRetryAttempts({})
    setFileName(file?.name || '')
    setReading(true)
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Choose a .csv file exported from Goodreads.')
      if (file.size > MAX_CSV_BYTES) throw new Error('Please upload a CSV smaller than 10 MB.')
      const text = await file.text()
      if (version !== selection.current) return
      const nextPreview = parseGoodreadsCsv(text)
      setPreview(nextPreview)
      try {
        const {keys} = await getReaderLibraryIndex()
        if (version !== selection.current) return
        setLibraryKeys(keys)
      } catch {
        if (version === selection.current) setLibraryKeys(null)
      }
    } catch (error) {
      if (version === selection.current) setError((error as Error).message)
    } finally {
      if (version === selection.current) setReading(false)
    }
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (uploadDisabled || running.current) return
    if (event.dataTransfer.files.length !== 1) {
      setError('Please drop one Goodreads CSV file at a time.')
      return
    }
    void selectFile(event.dataTransfer.files[0])
  }

  async function startImport() {
    if (!preview || running.current) return
    running.current = true
    setBusy(true); setError(''); setComplete(false); setResults([]); setRetryAttempts({})
    try {
      const keys = libraryKeys ?? (await getReaderLibraryIndex()).keys
      const {owned, missing} = partitionGoodreadsBooks(preview.books, libraryIndexFromKeys(keys))
      setResults(owned.map(skippedOwned))
      for (let offset = 0; offset < missing.length; offset += IMPORT_BATCH_SIZE) {
        const batch = await importGoodreadsBatch(missing.slice(offset, offset + IMPORT_BATCH_SIZE))
        setResults((previous) => [...previous, ...batch])
      }
      setComplete(true)
    } catch {
      setError('The import was interrupted. Books already saved are safe. Check your connection and sign-in, then retry the titles that failed.')
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  async function retryBook(book: NonNullable<GoodreadsPreview['books']>[number]) {
    if (uploadDisabled || running.current || retryingRow !== null) return
    if (importRetriesExhausted(retryAttempts[book.row] ?? 0)) return
    setRetryingRow(book.row)
    setError('')
    try {
      const [result] = await importGoodreadsBatch([book])
      setRetryAttempts((previous) => ({...previous, [book.row]: (previous[book.row] ?? 0) + 1}))
      setResults((previous) => {
        const next = previous.filter((item) => item.row !== book.row)
        return [...next, result]
      })
    } catch {
      setRetryAttempts((previous) => ({...previous, [book.row]: (previous[book.row] ?? 0) + 1}))
      setError('This title could not be retried. Check your connection and sign-in, then try again.')
    } finally {
      setRetryingRow(null)
    }
  }

  const imported = results.filter((item) => item.status === 'imported').length
  const updated = results.filter((item) => item.status === 'updated').length
  const skipped = results.filter((item) => item.status === 'skipped').length
  const failed = results.filter((item) => item.status === 'failed')
  const review = preview && libraryKeys
    ? partitionGoodreadsBooks(preview.books, libraryIndexFromKeys(libraryKeys))
    : null
  const importLabel = review
    ? review.missing.length
      ? `Import ${review.missing.length} missing ${review.missing.length === 1 ? 'book' : 'books'}`
      : 'These titles are already on your shelves'
    : preview
      ? `Import ${preview.books.length} books`
      : 'Import books'
  const news = importReportNews({imported, updated, skipped, failed: failed.length})
  const importedTitles = results.filter((item) => item.status === 'imported' || item.status === 'updated')

  useEffect(() => {
    if (complete) reportRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})
  }, [complete])

  return (
    <section className="surface mt-8 p-6 sm:p-8" aria-labelledby="goodreads-heading">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eee7da] font-display text-3xl text-[#53432e]">g</span>
        <div><h2 id="goodreads-heading" className="font-display text-2xl">Import from Goodreads</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Pick up where you left off. Upload your Goodreads CSV to bring your books onto your shelves.</p></div>
      </div>
      <ol className="my-6 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
        <li>Open <a className="text-ink underline underline-offset-4" href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer">Goodreads Import/Export <span className="sr-only">(opens in a new tab)</span></a> and select <strong>Export Library</strong>.</li>
        <li>Download the CSV when Goodreads has finished preparing it.</li>
        <li>Upload it below, review the shelves, and import your books.</li>
      </ol>
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(SHELF_LABELS).map(([status, label]) => (
          <div key={status} className="rounded-2xl border px-4 py-3">
            <p className="text-xs text-muted">{status === 'finished' ? 'read' : status === 'wantToRead' ? 'to-read' : 'currently-reading'} →</p>
            <p className="mt-1 text-sm font-semibold">{label}</p>
            {preview ? <p className="mt-2 text-2xl font-display">{preview.books.filter((book) => book.status === status).length}</p> : null}
          </div>
        ))}
      </div>
      <div
        role="group"
        aria-label="Upload Goodreads CSV"
        aria-disabled={uploadDisabled}
        className={`mt-6 rounded-2xl border border-dashed p-5 transition-colors sm:p-6 ${dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : ''} ${uploadDisabled ? 'opacity-60' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          if (uploadDisabled || !event.dataTransfer.types.includes('Files')) return
          dragDepth.current++
          setDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = uploadDisabled ? 'none' : 'copy'
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (!dragDepth.current) setDragging(false)
        }}
        onDrop={dropFile}
      >
        <h3 className="font-semibold">Upload Goodreads CSV</h3>
        <p className="mt-2 text-sm">{dragging ? 'Drop your CSV here' : 'Drag and drop your CSV here, or choose a file below.'}</p>
        <p id="csv-help" className="mt-1 text-xs leading-5 text-muted">CSV only · Up to 10 MB and 10,000 books</p>
        <input id="goodreads-csv" type="file" accept=".csv,text/csv" disabled={uploadDisabled} onChange={(event) => {
          void selectFile(event.target.files?.[0])
          event.target.value = ''
        }} aria-describedby="csv-help" className="peer sr-only" />
        <label htmlFor="goodreads-csv" className="pill mt-4 inline-flex cursor-pointer rounded-sm! px-4 py-2 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed">Choose CSV file</label>
        {fileName ? <p className="mt-3 wrap-break-word text-sm text-muted" role="status">Selected file: {fileName}</p> : null}
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">Includes your ratings, shelf status, date added, date read, and read count when available. Uploading the same CSV again checks titles already on your shelves and only adds the missing ones. Existing ratings, shelves, and dates stay as they are. A Goodreads rating of 0 means unrated. Reviews, custom shelves, and individual reread dates are not imported.</p>
      {reading ? <p role="status" className="mt-4 text-sm">{preview ? 'Checking titles already on your shelves…' : 'Reading your CSV…'}</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      {preview ? (
        <div className="mt-6 border-t pt-6">
          {complete ? null : <h3 className="font-semibold">Review your import</h3>}
          <p className="mt-1 wrap-break-word text-sm text-muted">{fileName} · {preview.total} rows · {preview.books.length} in the file · {review ? `${review.missing.length} not on your shelves yet · ${review.owned.length} already in your library` : 'checking your shelves'} · {preview.books.filter((book) => book.rating !== undefined).length} with ratings · {preview.issues.length} skipped in preview</p>
          {preview.issues.length ? (
            <details className="mt-3 text-sm"><summary className="cursor-pointer">Review skipped rows ({preview.issues.length})</summary>
              <ul className="mt-2 max-h-60 space-y-2 overflow-auto text-muted">{preview.issues.map((issue) => <li key={issue.row}>Row {issue.row}: {issue.title || 'Untitled'} — {issue.message}</li>)}</ul>
            </details>
          ) : null}
          {preview.books.length > 0 && !complete ? <button type="button" className="pill is-active mt-5 px-5 py-2.5 text-sm disabled:opacity-60" disabled={busy || retryingRow !== null || reading} onClick={startImport}>{busy ? 'Importing…' : results.length ? 'Retry import' : importLabel}</button> : null}
          {(busy || (results.length > 0 && !complete)) ? (
            <div className="mt-5" role="status" aria-live="polite">
              <progress className="h-2 w-full accent-[var(--accent)]" value={results.length} max={preview.books.length} aria-label="Books processed" />
              <p className="mt-2 text-sm">{results.length} of {preview.books.length} processed · {imported} imported · {updated} ratings added · {skipped} already in your library · {failed.length} failed</p>
              {busy ? <p className="mt-1 text-xs text-muted">Keep this page open until the import finishes.</p> : null}
            </div>
          ) : null}
          {complete ? (
            <ImportReport
              reportRef={reportRef}
              news={news}
              imported={imported}
              updated={updated}
              skipped={skipped}
              failed={failed}
              importedTitles={importedTitles}
              preview={preview}
              busy={busy}
              retryingRow={retryingRow}
              retryAttempts={retryAttempts}
              onRetry={retryBook}
            />
          ) : failed.length ? (
            <FailedTitles
              failed={failed}
              preview={preview}
              busy={busy}
              retryingRow={retryingRow}
              retryAttempts={retryAttempts}
              onRetry={retryBook}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function pad(count: number) {
  return String(count).padStart(2, '0')
}

function ImportReport({
  reportRef,
  news,
  imported,
  updated,
  skipped,
  failed,
  importedTitles,
  preview,
  busy,
  retryingRow,
  retryAttempts,
  onRetry,
}: {
  reportRef: RefObject<HTMLElement | null>
  news: ReturnType<typeof importReportNews>
  imported: number
  updated: number
  skipped: number
  failed: ImportResult[]
  importedTitles: ImportResult[]
  preview: GoodreadsPreview
  busy: boolean
  retryingRow: number | null
  retryAttempts: Record<number, number>
  onRetry: (book: GoodreadsBook) => void
}) {
  return (
    <article ref={reportRef} className="mt-6 scroll-mt-6 border border-(--line) p-5 sm:p-6" aria-labelledby="import-report-heading">
      <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Import report</p>
      <h3 id="import-report-heading" className="mt-3 font-display text-[1.85rem] leading-[0.95] font-black tracking-[-0.06em]">
        {news.headline}
      </h3>
      <p className="mt-3 max-w-xl text-[1.02rem] leading-7 text-muted">{news.body}</p>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {(
          [
            {label: 'Added to shelves', value: imported},
            {label: 'Ratings filled', value: updated},
            {label: 'Already there', value: skipped},
            {label: 'Didn’t save', value: failed.length},
          ] as const
        ).map((stat) => (
          <div key={stat.label}>
            <dt className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted uppercase">{stat.label}</dt>
            <dd className="mt-2 font-display text-[1.85rem] leading-none font-black tracking-[-0.06em]">{pad(stat.value)}</dd>
          </div>
        ))}
      </dl>
      {importedTitles.length ? (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer font-medium">What landed on your shelves ({importedTitles.length})</summary>
          <ul className="mt-3 max-h-60 space-y-2 overflow-auto text-muted">
            {importedTitles.map((item) => (
              <li key={item.row}>{item.title}{item.message ? ` — ${item.message}` : ''}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {preview.issues.length ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">Rows we couldn’t read ({preview.issues.length})</summary>
          <ul className="mt-3 max-h-60 space-y-2 overflow-auto text-muted">
            {preview.issues.map((issue) => (
              <li key={issue.row}>Row {issue.row}: {issue.title || 'Untitled'} — {issue.message}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {failed.length ? (
        <div className="mt-6">
          <FailedTitles
            failed={failed}
            preview={preview}
            busy={busy}
            retryingRow={retryingRow}
            retryAttempts={retryAttempts}
            onRetry={onRetry}
          />
          {failed.some((item) => importRetriesExhausted(retryAttempts[item.row] ?? 0)) ? (
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
              The Everlogue librarian will take care of any title that still won’t load. It will be added to your shelf in the next 1–2 days.
            </p>
          ) : (
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
              You can retry a title twice. If it still won’t load, the Everlogue librarian will take it from here and add it to your shelf in the next 1–2 days.
            </p>
          )}
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/my-books" className="pill is-active px-5 py-2.5 text-sm">View My Books</Link>
      </div>
    </article>
  )
}

function FailedTitles({
  failed,
  preview,
  busy,
  retryingRow,
  retryAttempts,
  onRetry,
}: {
  failed: ImportResult[]
  preview: GoodreadsPreview
  busy: boolean
  retryingRow: number | null
  retryAttempts: Record<number, number>
  onRetry: (book: GoodreadsBook) => void
}) {
  const canRetryAny = failed.some((item) => !importRetriesExhausted(retryAttempts[item.row] ?? 0))
  return (
    <div>
      <h4 className="font-semibold">Couldn’t add ({failed.length})</h4>
      <p className="mt-1 text-sm text-muted">
        {canRetryAny
          ? 'Retry a title up to two times. Books that already saved stay on your shelves.'
          : 'These titles are with the Everlogue librarian now. They’ll be added to your shelf in the next 1–2 days.'}
      </p>
      <ul className="mt-3 divide-y divide-(--line) border-y border-(--line)">
        {failed.map((item) => {
          const book = preview.books.find((entry) => entry.row === item.row)
          const handedOff = importRetriesExhausted(retryAttempts[item.row] ?? 0)
          return (
            <li key={item.row} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                {book?.author ? <p className="mt-1 text-sm text-muted">{book.author}</p> : null}
                {item.message && !handedOff ? <p className="mt-1 text-sm text-muted">{item.message}</p> : null}
                {handedOff ? <p className="mt-1 text-sm text-muted">{LIBRARIAN_HANDOFF}</p> : null}
              </div>
              {handedOff ? null : (
                <button
                  type="button"
                  className="pill rounded-sm! px-4 py-2 text-sm disabled:opacity-60"
                  disabled={!book || retryingRow !== null || busy}
                  onClick={() => book && onRetry(book)}
                >
                  {retryingRow === item.row ? 'Retrying…' : 'Retry'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
