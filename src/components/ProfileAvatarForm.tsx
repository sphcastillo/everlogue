'use client'

import Image from 'next/image'
import {useRef, useState, useTransition} from 'react'
import {clearProfileAvatarAction, saveProfileAvatarAction} from '@/lib/server-actions'

export function ProfileAvatarForm({
  src,
  hasCustomAvatar,
  initials,
}: {
  src?: string | null
  hasCustomAvatar: boolean
  initials: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function upload(file?: File) {
    if (!file || pending) return
    const data = new FormData()
    data.set('avatar', file)
    setError('')
    startTransition(async () => {
      try {
        await saveProfileAvatarAction(data)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not upload that image.')
      }
    })
  }

  return (
    <section>
      <p className="text-[0.62rem] font-medium tracking-[0.2em] text-muted uppercase">Portrait</p>
      <div className="mt-4 flex items-center justify-between gap-6 border-y border-(--line) py-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-ink">
            {src ? (
              <Image src={src} alt="" fill sizes="64px" className="object-cover" unoptimized={/^https?:/i.test(src)} />
            ) : (
              <span className="grid size-full place-items-center text-sm font-medium tracking-wide text-white uppercase">
                {initials}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[1.35rem] leading-none font-black tracking-[-0.04em]">Profile image</h2>
            <p className="mt-2 max-w-lg text-[0.95rem] leading-relaxed text-muted">
              {hasCustomAvatar
                ? 'This image is used in the header. Remove it to fall back to your Clerk avatar.'
                : 'Upload an image for the header. Until then, your Clerk avatar URL is used.'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              upload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => input.current?.click()}
            className="inline-flex min-h-10 items-center border border-ink bg-ink px-4 font-sans text-[0.62rem] font-medium tracking-[0.16em] text-white uppercase hover:bg-black disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Upload image'}
          </button>
          {hasCustomAvatar ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError('')
                startTransition(async () => {
                  try {
                    await clearProfileAvatarAction()
                  } catch {
                    setError('Could not remove the image.')
                  }
                })
              }}
              className="text-[0.62rem] font-medium tracking-[0.16em] text-muted uppercase hover:text-ink disabled:opacity-60"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  )
}
