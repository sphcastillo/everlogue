import Image from 'next/image'
import {clubImageUrl, type ClubImage} from '@/sanity/image'

export function ClubMark({
  image,
  initials,
  title,
  className = 'size-10',
}: {
  image?: ClubImage
  initials: string
  title: string
  className?: string
}) {
  const src = clubImageUrl(image)
  const frame = `relative shrink-0 overflow-hidden rounded-full border border-[#d6d6d6]! ${className}`
  if (!src) {
    return (
      <span className={`grid place-items-center text-[0.62rem] font-medium tracking-[0.08em] ${frame}`}>
        {initials}
      </span>
    )
  }
  return (
    <span className={frame}>
      <Image src={src} alt={image?.alt || title} fill sizes="40px" className="object-cover" />
    </span>
  )
}
