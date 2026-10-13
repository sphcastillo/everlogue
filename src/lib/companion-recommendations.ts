export type VisibleRecommendation = {
  _id: string
  recommendationKey: string
}

export type VisibleRecommendationGroup<T extends VisibleRecommendation = VisibleRecommendation> = {
  _key: string
  recommendedAt: string
  books: T[]
}

export function hiddenRecommendationMarks(recommendationKey: string) {
  const separator = recommendationKey.indexOf(':')
  const bookId = separator >= 0 ? recommendationKey.slice(separator + 1) : ''
  return bookId ? [recommendationKey, `book:${bookId}`] : [recommendationKey]
}

export function isHiddenRecommendation(
  hidden: Iterable<string>,
  recommendationKey: string,
  bookId: string,
) {
  const blocked = hidden instanceof Set ? hidden : new Set(hidden)
  return blocked.has(recommendationKey) || blocked.has(`book:${bookId}`)
}

export function finalizeRecommendationGroups<T extends VisibleRecommendation>(
  groups: Array<VisibleRecommendationGroup<T>>,
) {
  const seen = new Set<string>()
  return groups.flatMap((group) => {
    const books = group.books.filter((book) => {
      if (seen.has(book._id)) return false
      seen.add(book._id)
      return true
    })
    return books.length ? [{...group, books}] : []
  })
}

export function recommendationCount<T extends VisibleRecommendation>(
  groups: Array<VisibleRecommendationGroup<T>>,
) {
  return groups.reduce((sum, group) => sum + group.books.length, 0)
}
