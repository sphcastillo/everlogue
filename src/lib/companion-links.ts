type LinkableSelection = {
  book: {
    title: string
    slug?: string
    _id: string
  }
}

function escapedRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function bookHref(book: LinkableSelection['book']) {
  return `/books/${encodeURIComponent(book.slug || book._id)}`
}

export function plainRecommendationTitles(text: string) {
  return [...text.matchAll(
    /(?:^|\n)\s*\d+[.)]\s+(.+?)\s+(?:—|–|-)\s+[^\n]+/g,
  )]
    .map(match => match[1].trim())
    .filter(title => title.length > 0 && !title.startsWith('['))
}

export function linkRecommendationTitles(
  text: string,
  selections: LinkableSelection[],
) {
  let answer = text

  for (const {book} of selections) {
    const href = bookHref(book)
    if (answer.includes(`](${href})`)) continue

    answer = answer.replace(
      new RegExp(
        `(^|\\n)(\\s*\\d+[.)]\\s+)${escapedRegExp(book.title)}(?=\\s+(?:—|–|-|by\\b))`,
        'im',
      ),
      (_, lineStart: string, listMarker: string) =>
        `${lineStart}${listMarker}[${book.title}](${href})`,
    )
  }

  const missingLinks = selections.flatMap(({book}) => {
    const href = bookHref(book)
    return answer.includes(`](${href})`) ? [] : [`[${book.title}](${href})`]
  })

  if (missingLinks.length) {
    answer = `${answer.trimEnd()}\n\nOpen in Everlogue: ${missingLinks.join(' · ')}`
  }

  return answer
}
