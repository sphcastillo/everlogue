export function clubInitials(name?: string | null, fallbackTitle?: string) {
  const source = name?.trim()
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    return source.slice(0, 2).toUpperCase()
  }
  const letters = (fallbackTitle || '').replace(/[^A-Za-z]/g, '')
  return letters.slice(0, 2).toUpperCase() || 'BC'
}

export function splitClubTitle(title: string) {
  const trimmed = title.trim()
  const bookClub = trimmed.match(/^(.*?)(?:\s+book\s+club\.?)$/i)
  if (bookClub?.[1]) {
    return {headline: bookClub[1].trim(), italic: 'book club.'}
  }
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return {headline: words.slice(0, -1).join(' '), italic: `${words[words.length - 1]}.`}
  }
  return {headline: trimmed, italic: null as string | null}
}

export function firstSentence(text?: string | null) {
  if (!text) return null
  const compact = text.replace(/\s+/g, ' ').trim()
  const match = compact.match(/^(.+?[.!?])(\s|$)/)
  return (match?.[1] || compact).slice(0, 180)
}
