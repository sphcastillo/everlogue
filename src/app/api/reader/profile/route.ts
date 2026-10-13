import {getReaderProfileShowcase} from '@/lib/actions'
import {readerApi} from '@/lib/reader-api'

export async function GET(request: Request) {
  return readerApi(request, async (reader) => {
    const {ratings, reviews} = await getReaderProfileShowcase()
    return {profile: {
      displayName: reader.displayName,
      spaceColor: reader.spaceColor ?? null,
      avatarSrc: reader.avatarSrc ?? null,
      hasCustomAvatar: reader.hasCustomAvatar ?? false,
      ratingCount: ratings.length,
      reviewCount: reviews.length,
      ratings,
      reviews,
    }}
  })
}
