import Link from 'next/link'
import type {ReactElement} from 'react'

export function CompanionMessageText({text}: {text: string}) {
  const links = /\[([^\]\n]+)\]\((\/books\/[A-Za-z0-9._~%+-]+)\)/g
  const content: (string | ReactElement)[] = []
  let cursor = 0

  for (const match of text.matchAll(links)) {
    const index = match.index ?? 0
    content.push(text.slice(cursor, index))
    content.push(
      <Link
        key={`${match[2]}-${index}`}
        href={match[2]}
        className="font-semibold underline decoration-(--palette-clay) underline-offset-2 hover:text-(--palette-clay)"
      >
        {match[1]}
      </Link>,
    )
    cursor = index + match[0].length
  }

  content.push(text.slice(cursor))
  return content
}
