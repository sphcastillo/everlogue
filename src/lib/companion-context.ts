import type {CatalogMatch} from './companion-catalog'

function relevance(text: string, terms: string[]) {
  const lower = text.toLowerCase()
  return terms.filter(term => term.length > 2 && lower.includes(term.toLowerCase())).length
}

/** Extract complete source sentences where possible. Never generate new metadata. */
export function relevantExcerpt(text: string | undefined, terms: string[], maxLength: number) {
  if (!text || text.length <= maxLength) return text
  const sentences = text.match(/[^.!?\n]+[.!?]?/g) || [text]
  const ranked = sentences.map((sentence, index) => ({sentence, index, score: relevance(sentence, terms)}))
    .sort((a, b) => b.score - a.score || a.index - b.index)
  const selected: typeof ranked = []
  let length = 0
  for (const item of ranked) {
    if (length + item.sentence.length + 1 > maxLength) continue
    selected.push(item)
    length += item.sentence.length + 1
  }
  return selected.length ? selected.sort((a, b) => a.index - b.index).map(item => item.sentence.trim()).join(' ') : text.slice(0, maxLength) + '…'
}

export function compactCandidate(book: CatalogMatch, terms: string[]) {
  return {...book, description: relevantExcerpt(book.description, terms, 900)}
}

type PreferenceBook = {_id?: string; title?: string; authors?: string[]; description?: string; genres?: string[]}
type Rating = {value: number; book?: PreferenceBook}
type Review = {title?: string; body?: string; hasSpoilers?: boolean; rating?: number; book?: PreferenceBook}
export function compactPreferences(data: {status?: string; ratings?: Rating[]; reviews?: Review[]}, terms: string[]) {
  const score = (item: {book?: PreferenceBook; body?: string}) => relevance(JSON.stringify(item), terms)
  return {
    status: data.status,
    scope: 'Relevant excerpts from recent feedback, not a complete taste profile. Omitted and unrated books are unknown.',
    ratings: [...(data.ratings || [])].sort((a, b) => score(b) - score(a)).slice(0, 10).map(item => ({
      value: item.value, book: item.book && {...item.book, description: relevantExcerpt(item.book.description, terms, 350)},
    })),
    reviews: [...(data.reviews || [])].sort((a, b) => score(b) - score(a)).slice(0, 4).map(item => ({
      ...item, body: relevantExcerpt(item.body, terms, 650),
    })),
  }
}
