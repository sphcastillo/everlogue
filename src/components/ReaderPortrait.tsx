'use client'

import Image from 'next/image'
import {useUser} from '@clerk/nextjs'
import {useState} from 'react'

export function ReaderPortrait({
  src,
  hasCustomAvatar = false,
  initials,
  sizes,
}: {
  src?: string | null
  hasCustomAvatar?: boolean
  initials: string
  sizes: string
}) {
  const {user} = useUser()
  const [failed, setFailed] = useState(false)
  const portrait = hasCustomAvatar ? src : user?.imageUrl || null

  if (!portrait || failed) {
    return (
      <span className="grid size-full place-items-center text-[0.7em] font-medium tracking-wide text-white uppercase">
        {initials}
      </span>
    )
  }

  return (
    <Image
      src={portrait}
      alt=""
      fill
      sizes={sizes}
      className="object-cover"
      unoptimized
      onError={() => setFailed(true)}
    />
  )
}
