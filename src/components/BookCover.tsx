'use client'

import Image from 'next/image'
import {useState} from 'react'
import {isProviderPlaceholderImage, placeholderCoverSrc, type CoverSource} from '@/lib/book-covers'
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
  quality = 90,
}: {
  cover?: CoverSource | null
  title: string
  priority?: boolean
  className?: string
  sizes?: string
  imageWidth?: number
  quality?: number
}) {
  const alt = cover?.coverOverride?.alt || `Cover of ${title}`
  const sanitySrc = sanityImageSrc(cover?.coverOverride, imageWidth, Math.round(imageWidth * 1.5), quality)
  const urls = coverUrls(cover, {width: imageWidth, quality})
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
          quality={quality}
          className="rounded-none object-cover"
        />
      ) : (
        <RemoteCover key={urls.join('|')} urls={urls} title={title} alt={alt} priority={priority} sizes={sizes} quality={quality} />
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
  quality,
}: {
  urls: string[]
  title: string
  alt: string
  priority: boolean
  sizes: string
  quality: number
}) {
  const [index, setIndex] = useState(0)
  const src = urls[index]
  if (!src) {
    return (
      <Image
        src={placeholderCoverSrc(title)}
        alt={alt || `Placeholder cover for ${title}`}
        fill
        sizes={sizes}
        quality={quality}
        className="rounded-none object-cover"
        priority={priority}
      />
    )
  }
  const remote = /^https?:/i.test(src)
  return (
    <Image
      src={src}
      alt={alt || `Cover of ${title}`}
      fill
      sizes={sizes}
      quality={quality}
      className="rounded-none object-cover"
      priority={priority}
      unoptimized={remote}
      onError={() => setIndex((current) => current + 1)}
      onLoad={(event) => {
        const image = event.currentTarget
        if (isProviderPlaceholderImage(src, image.naturalWidth, image.naturalHeight)) {
          setIndex((current) => current + 1)
        }
      }}
    />
  )
}
