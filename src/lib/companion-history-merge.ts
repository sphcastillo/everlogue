export type CompanionHistoryMessage = {
  _key?: string
  role: 'user' | 'assistant'
  text: string
  createdAt?: string
}

export const MAX_COMPANION_HISTORY_MESSAGES = 40

function validKey(value?: string) {
  return Boolean(value && /^[A-Za-z0-9._-]+$/.test(value))
}

function contentIdentity(message: CompanionHistoryMessage) {
  return `${message.createdAt || ''}:${message.role}:${message.text}`
}

export function dedupeCompanionHistory(messages: CompanionHistoryMessage[]) {
  const seenKeys = new Set<string>()
  const seenContent = new Set<string>()
  return messages.filter((message) => {
    const content = contentIdentity(message)
    if (validKey(message._key) && seenKeys.has(message._key!)) return false
    if (seenContent.has(content)) return false
    if (validKey(message._key)) seenKeys.add(message._key!)
    seenContent.add(content)
    return true
  })
}

export function mergeCompanionHistory(
  existing: CompanionHistoryMessage[],
  incoming: CompanionHistoryMessage[],
) {
  const seenKeys = new Set<string>()
  const seenContent = new Set<string>()
  for (const message of existing) {
    if (validKey(message._key)) seenKeys.add(message._key!)
    seenContent.add(contentIdentity(message))
  }
  const added = incoming.filter((message) => {
    const content = contentIdentity(message)
    if (validKey(message._key) && seenKeys.has(message._key!)) return false
    if (seenContent.has(content)) return false
    if (validKey(message._key)) seenKeys.add(message._key!)
    seenContent.add(content)
    return true
  })
  return [...existing, ...added].slice(-MAX_COMPANION_HISTORY_MESSAGES)
}
