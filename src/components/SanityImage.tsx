import Image from 'next/image'
import type {SanityImageSource} from '@sanity/image-url/lib/types/types'
import {urlFor} from '@/sanity/image'

export type SanityImageValue = {
  asset?: {_id?: string; _ref?: string; url?: string | null} | null
  alt?: string | null
  hotspot?: unknown
  crop?: unknown
} | null

export function sanityImageSrc(
  value: SanityImageValue | SanityImageSource | null | undefined,
  width: number,
  height?: number,
  quality = 85,
) {
  if (!value || typeof value !== 'object' || !('asset' in value) || !value.asset) return null
  let builder = urlFor(value as SanityImageSource).width(width).quality(quality).auto('format')
  builder = height ? builder.height(height).fit('crop') : builder.fit('max')
  return builder.url()
}

export function SanityImage({
  value,
  alt,
  width = 800,
  height,
  fill = false,
  sizes,
  className,
  priority = false,
  quality = 85,
}: {
  value: SanityImageValue
  alt: string
  width?: number
  height?: number
  fill?: boolean
  sizes?: string
  className?: string
  priority?: boolean
  quality?: number
}) {
  const resolvedHeight = height ?? Math.round(width * 1.5)
  const src = sanityImageSrc(value, width, resolvedHeight, quality)
  if (!src) return null

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt || value?.alt || ''}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        quality={quality}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt || value?.alt || ''}
      width={width}
      height={resolvedHeight}
      sizes={sizes}
      className={className}
      priority={priority}
      quality={quality}
    />
  )
}
