import Link from 'next/link'
import {auth} from '@clerk/nextjs/server'
import {ProfileAvatarForm} from '@/components/ProfileAvatarForm'
import {getOptionalReader} from '@/lib/reader'

export default async function SettingsPage() {
  await auth.protect()
  const reader = await getOptionalReader().catch(() => null)
  const initials = reader?.displayName?.trim().charAt(0) || 'R'

  return (
    <div className="px-5 pb-20 sm:px-8 lg:px-9">
      <header className="pt-8 pb-10">
        <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Your account</p>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,4.6rem)] leading-[0.88] font-black tracking-[-0.07em]">
          Settings<span className="text-[#b8b8b8]" aria-hidden="true">.</span>
        </h1>
        <p className="mt-4 max-w-md text-[1.02rem] leading-7 text-muted">
          Make yourself at home. Manage your library and how you read here.
        </p>
      </header>

      <div className="grid gap-12">
        <ProfileAvatarForm
          src={reader?.avatarSrc}
          hasCustomAvatar={Boolean(reader?.hasCustomAvatar)}
          initials={initials}
        />

        <section>
          <p className="text-[0.62rem] font-medium tracking-[0.2em] text-muted uppercase">Library</p>
          <Link
            href="/settings/library/import-export"
            className="mt-4 flex items-center justify-between gap-6 border-y border-(--line) py-6"
          >
            <div>
              <h2 className="font-display text-[1.35rem] leading-none font-black tracking-[-0.04em]">Import &amp; Export</h2>
              <p className="mt-2 max-w-lg text-[0.95rem] leading-relaxed text-muted">
                Bring your Goodreads history to Everlogue, or take a copy of your library with you.
              </p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center border border-ink" aria-hidden="true">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                <path d="M3 8h9" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 4l5 4-5 4" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
          </Link>
        </section>
      </div>
    </div>
  )
}
