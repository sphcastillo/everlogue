export type CompanionBook = {
  title?: string | null
  authors?: string[] | null
  slug?: string | null
}

export type CompanionShelf = {
  kind?: string
  name?: string
  entries?: {book?: CompanionBook | null}[]
}

function booksOn(shelf?: CompanionShelf) {
  return (shelf?.entries || []).flatMap((entry) => (entry.book?.title ? [entry.book] : []))
}

function listBooks(books: CompanionBook[], limit = 8) {
  if (!books.length) return null
  return books
    .slice(0, limit)
    .map((book) => {
      const authors = book.authors?.filter(Boolean).join(', ')
      return authors ? `${book.title} by ${authors}` : book.title
    })
    .join('; ')
}

function findInLibrary(shelves: CompanionShelf[], query: string) {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1)
  if (!tokens.length) return []
  const seen = new Set<string>()
  const matches: CompanionBook[] = []
  for (const shelf of shelves) {
    for (const book of booksOn(shelf)) {
      const key = book.slug || book.title || ''
      if (seen.has(key)) continue
      const haystack = `${book.title} ${book.authors?.join(' ') || ''}`.toLowerCase()
      if (tokens.every((token) => haystack.includes(token))) {
        seen.add(key)
        matches.push(book)
      }
    }
  }
  return matches
}

export function companionReply(message: string, shelves: CompanionShelf[]) {
  const text = message.replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  const byKind = new Map(shelves.map((shelf) => [shelf.kind, shelf]))
  const reading = booksOn(byKind.get('currentlyReading'))
  const want = booksOn(byKind.get('wantToRead'))
  const finished = booksOn(byKind.get('finished'))
  const signedIn = shelves.length > 0

  if (!text) {
    return 'Ask about a title on your shelves, what to read next, or where you left off.'
  }

  if (/current(ly)? read|on (my )?shelf now|where i left|midway/.test(lower)) {
    if (!signedIn) return 'Sign in and I can look at what you are currently reading.'
    const listed = listBooks(reading)
    return listed
      ? `You are currently reading ${listed}.`
      : 'Nothing is on Currently reading yet. Put a book there from a title page, then ask again.'
  }

  if (/want to read|tbr|to-be-read|next chapter|saved for later/.test(lower)) {
    if (!signedIn) return 'Sign in and I can read your Want to read shelf.'
    const listed = listBooks(want)
    return listed
      ? `Waiting on your Want to read shelf: ${listed}.`
      : 'Want to read is empty. Save a title from search or Discover, then I can choose from it.'
  }

  if (/what should i read|read next|recommend|suggestion|next book/.test(lower)) {
    if (!signedIn) {
      return 'Sign in so I can choose from your shelves. Until then, Discover is the place to browse club lists.'
    }
    if (reading.length) {
      return `Finish what is open first: ${listBooks(reading, 3)}. If you want a new start, ask about Want to read.`
    }
    const listed = listBooks(want, 5)
    return listed
      ? `From Want to read, I would start with ${listed}.`
      : 'Your shelves are quiet. Add a book from Discover or search, then ask me again.'
  }

  const libraryHits = signedIn ? findInLibrary(shelves, text) : []
  if (libraryHits.length) {
    return `On your shelves I found ${listBooks(libraryHits, 6)}.`
  }

  if (signedIn) {
    const counts = [reading.length && `${reading.length} currently reading`, want.length && `${want.length} want to read`, finished.length && `${finished.length} read`]
      .filter(Boolean)
      .join(', ')
    return counts
      ? `I can look through your shelves (${counts}). Ask what to read next, for current reads, or name a title.`
      : 'Your shelves are empty so far. Save a book, then I can talk about it with you.'
  }

  return 'Sign in to let me see your shelves. You can also search from the header or browse Discover.'
}
