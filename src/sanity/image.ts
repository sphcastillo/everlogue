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
