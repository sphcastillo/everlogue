'use client'

export function HomeGreeting({displayName}: {displayName?: string | null}) {
  const now = new Date()
  const hour = now.getHours()
  const period = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const date = new Intl.DateTimeFormat('en-US', {weekday: 'long', month: 'long', day: 'numeric'}).format(now)
  const name = displayName?.trim().split(/\s+/)[0]

  return (
    <div>
      <p className="flex h-7 items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-current/70 min-[875px]:text-muted">
        <span className="inline-block size-1.5 shrink-0 bg-current" aria-hidden="true" />
        {date}
      </p>
      <p className="mt-10 font-accent text-[clamp(1.35rem,2vw,1.75rem)] leading-none font-normal italic min-[875px]:mt-4">
        {name ? `${period}, ${name}` : period}
      </p>
    </div>
  )
}
