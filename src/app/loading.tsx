export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="page-wait flex min-h-[55vh] flex-col items-center justify-center px-5 py-24"
    >
      <p className="flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.22em] text-muted uppercase">
        Just a moment
      </p>
      <span className="sr-only">Loading</span>
      <span className="page-wait-track" aria-hidden="true">
        <span className="page-wait-rule" />
      </span>
    </div>
  )
}
