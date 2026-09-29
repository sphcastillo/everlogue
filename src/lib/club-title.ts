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
  for (let index = 0; index < compact.length; index += 1) {
    const mark = compact[index]
    if (mark !== '.' && mark !== '!' && mark !== '?') continue
    const prev = compact[index - 1]
    const beforePrev = compact[index - 2]
    const next = compact[index + 1]
    if (prev && /[A-Z]/.test(prev) && (!beforePrev || beforePrev === ' ' || beforePrev === '.')) continue
    if (next && next !== ' ') continue
    return compact.slice(0, index + 1)
  }
  return compact
}
