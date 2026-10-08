'use client'

import {useClerk, useUser} from '@clerk/nextjs'
import Link from 'next/link'
import {ReaderPortrait} from './ReaderPortrait'
import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react'

export function AccountMenu({
  avatarSrc,
  hasCustomAvatar = false,
}: {
  avatarSrc?: string | null
  hasCustomAvatar?: boolean
}) {
  const {user} = useUser()
  const {signOut} = useClerk()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const initialFocus = useRef(0)
  const menuId = useId()
  const name = user?.fullName || user?.username || 'Your account'
  const email = user?.primaryEmailAddress?.emailAddress
  const initials = [user?.firstName, user?.lastName].filter(Boolean).map((part) => part![0]).join('') || name[0]

  useEffect(() => {
    if (!open) return
    const items = menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
    items?.[initialFocus.current === -1 ? items.length - 1 : 0]?.focus()
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])
    const current = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
      (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  async function handleSignOut() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await signOut({redirectUrl: '/'})
    } catch {
      setError('Could not sign out. Please try again.')
      setPending(false)
    }
  }

  return (
    <div className="relative" ref={root} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
    }}>
      <button
        ref={trigger}
        type="button"
        className="relative grid size-8 place-items-center overflow-hidden rounded-full bg-ink text-[0.7rem] font-medium tracking-wide text-white uppercase"
        aria-label={`Account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => { initialFocus.current = 0; setOpen(!open) }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            initialFocus.current = event.key === 'ArrowUp' ? -1 : 0
            setOpen(true)
          }
        }}
      >
        <ReaderPortrait src={avatarSrc} hasCustomAvatar={hasCustomAvatar} initials={initials} sizes="32px" />
      </button>
      {open ? (
        <div className="account-dropdown">
          <div className="border-b px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            {email ? <p className="mt-0.5 truncate text-xs text-muted">{email}</p> : null}
          </div>
          <div ref={menu} id={menuId} role="menu" aria-label="Account" onKeyDown={navigate} className="pt-1">
            <Link href="/profile" role="menuitem" tabIndex={-1} className="account-menu-item" onClick={close}>Profile</Link>
            <Link href="/settings" role="menuitem" tabIndex={-1} className="account-menu-item" onClick={close}>Settings</Link>
            <div role="separator" className="my-1 border-t" />
            <button type="button" role="menuitem" tabIndex={-1} className="account-menu-item" aria-disabled={pending} onClick={handleSignOut}>
              {pending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
          {error ? <p role="alert" className="px-3 pb-2 text-xs text-red-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
