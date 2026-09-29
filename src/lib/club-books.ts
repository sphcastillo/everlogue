export type ClubEntrySortable = {
  selectionNumber?: number | null
  isLatestAddition?: boolean | null
  book?: {_id?: string | null} | null
}

export function latestClubEntries<T extends ClubEntrySortable>(entries: T[]) {
  const extras: T[] = []
  const stored: T[] = []
  for (const entry of entries) {
    if (!entry.book?._id) continue
    if (entry.isLatestAddition) extras.push(entry)
    else stored.push(entry)
  }

  const seen = new Set<string>()
  const newestFirst: T[] = []
  for (let index = stored.length - 1; index >= 0; index -= 1) {
    const id = stored[index].book?._id
    if (!id || seen.has(id)) continue
    seen.add(id)
    newestFirst.push(stored[index])
  }

  const newAdds = extras.filter((entry) => {
    const id = entry.book?._id
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })

  return [...newAdds, ...newestFirst]
}
