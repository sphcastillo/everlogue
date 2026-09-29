import {projectId, dataset} from './env'
import createImageUrlBuilder from '@sanity/image-url'
import type {SanityImageSource} from '@sanity/image-url/lib/types/types'
import {coverCandidates, hasManualCover, type CoverSource} from '@/lib/book-covers'

const builder = createImageUrlBuilder({projectId, dataset})

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

export function coverUrls(cover?: CoverSource | null) {
  const asset = cover?.coverOverride?.asset
  const built = asset?._id || asset?._ref ? urlFor(cover!.coverOverride!).width(800).height(1200).fit('crop').url() : null
  const manual = [...new Set([built, asset?.url].filter((url): url is string => Boolean(url)))]
  if (hasManualCover(cover) && manual.length) return manual
  return coverCandidates(cover, built || asset?.url)
}

export function coverSrc(cover?: CoverSource) {
  return coverUrls(cover)[0] || null
}

export type ClubImage = {
  asset?: {_id?: string; _ref?: string; url?: string | null} | null
  alt?: string | null
  hotspot?: unknown
  crop?: unknown
} | null

export function clubImageUrl(image?: ClubImage) {
  if (!image?.asset) return null
  const asset = image.asset
  if (asset._id || asset._ref) return urlFor(image as SanityImageSource).width(160).height(160).fit('crop').url()
  return asset.url || null
}
