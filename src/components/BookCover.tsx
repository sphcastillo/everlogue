'use client'

import Image from 'next/image'
import {useState} from 'react'
import type {CoverSource} from '@/lib/book-covers'
import {coverUrls} from '@/sanity/image'
import {SanityImage, sanityImageSrc} from './SanityImage'
export type {CoverSource} from '@/lib/book-covers'

export function BookCover({
  cover,
  title,
  priority = false,
  className = '',
  sizes = '(max-width: 768px) 45vw, 240px',
  imageWidth = 640,
}: {
  cover?: CoverSource | null
  title: string
  priority?: boolean
  className?: string
  sizes?: string
  imageWidth?: number
}) {
  const alt = cover?.coverOverride?.alt || `Cover of ${title}`
  const sanitySrc = sanityImageSrc(cover?.coverOverride, imageWidth, Math.round(imageWidth * 1.5), 90)
  const urls = coverUrls(cover, {width: imageWidth, quality: 90})
  return (
    <div className={`cover-frame relative overflow-hidden bg-(--accent-soft) ${className} rounded-none!`}>
      {sanitySrc ? (
        <SanityImage
          value={cover!.coverOverride!}
          alt={alt}
          fill
          width={imageWidth}
          height={Math.round(imageWidth * 1.5)}
          sizes={sizes}
          priority={priority}
          quality={90}
          className="rounded-none object-cover"
        />
      ) : (
        <RemoteCover key={urls.join('|')} urls={urls} title={title} alt={alt} priority={priority} sizes={sizes} />
      )}
    </div>
  )
}

function RemoteCover({
  urls,
  title,
  alt,
  priority,
  sizes,
}: {
  urls: string[]
  title: string
  alt: string
  priority: boolean
  sizes: string
}) {
  const [index, setIndex] = useState(0)
  const src = urls[index]
  if (!src) {
    return <div className="flex h-full items-end p-3 text-sm text-muted">Cover not in our catalog yet</div>
  }
  const remote = src.includes('books.google') || src.includes('covers.openlibrary.org')
  return (
    <Image
      src={src}
      alt={alt || `Cover of ${title}`}
      fill
      sizes={sizes}
      quality={90}
      className="rounded-none object-cover"
      priority={priority}
      unoptimized={remote}
      onError={() => setIndex((current) => current + 1)}
    />
  )
}
