import {existsSync, readFileSync} from 'node:fs'
import {createClient} from '@sanity/client'

function loadEnv() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '3h0o1unw'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN

if (!token) {
  console.error('SANITY_API_WRITE_TOKEN or SANITY_AUTH_TOKEN is required for import.')
  process.exit(1)
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2026-02-01',
  token,
  useCdn: false,
})

const contact = process.env.OPEN_LIBRARY_CONTACT_EMAIL || 'read-evermore-catalog@example.com'
const retrievedAt = new Date().toISOString()

const SEED = [
  {title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin', genre: 'fantasy', year: 1968, reprint: true},
  {title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', genre: 'science-fiction', year: 1969, reprint: true},
  {title: 'The Name of the Wind', author: 'Patrick Rothfuss', genre: 'fantasy', year: 2007, reprint: true},
  {title: 'The Fifth Season', author: 'N. K. Jemisin', genre: 'fantasy', year: 2015, reprint: true},
  {title: 'Piranesi', author: 'Susanna Clarke', genre: 'fantasy', year: 2020, reprint: false},
  {title: 'The Priory of the Orange Tree', author: 'Samantha Shannon', genre: 'fantasy', year: 2019, reprint: true},
  {title: 'Circe', author: 'Madeline Miller', genre: 'fantasy', year: 2018, reprint: true},
  {title: 'The Night Circus', author: 'Erin Morgenstern', genre: 'fantasy', year: 2011, reprint: true},
  {title: 'Project Hail Mary', author: 'Andy Weir', genre: 'science-fiction', year: 2021, reprint: false},
  {title: 'Klara and the Sun', author: 'Kazuo Ishiguro', genre: 'literary-fiction', year: 2021, reprint: false},
  {title: 'Babel', author: 'R. F. Kuang', genre: 'fantasy', year: 2022, reprint: false},
  {title: 'The House in the Cerulean Sea', author: 'T. J. Klune', genre: 'fantasy', year: 2020, reprint: false},
  {title: 'Gideon the Ninth', author: 'Tamsyn Muir', genre: 'fantasy', year: 2019, reprint: false},
  {title: 'The Goblin Emperor', author: 'Katherine Addison', genre: 'fantasy', year: 2014, reprint: true},
  {title: 'Jonathan Strange & Mr Norrell', author: 'Susanna Clarke', genre: 'fantasy', year: 2004, reprint: true},
  {title: 'The Poppy War', author: 'R. F. Kuang', genre: 'fantasy', year: 2018, reprint: false},
]

const GENRES = [
  {title: 'Fantasy', slug: 'fantasy'},
  {title: 'Science Fiction', slug: 'science-fiction'},
  {title: 'Literary Fiction', slug: 'literary-fiction'},
  {title: 'Romance', slug: 'romance'},
  {title: 'Mystery', slug: 'mystery'},
  {title: 'Epic Fantasy', slug: 'epic-fantasy', parent: 'fantasy'},
  {title: 'High Fantasy', slug: 'high-fantasy', parent: 'fantasy'},
]

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 96)
}

async function olJson(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': `ReadEvermore/0.1 (catalog import; ${contact})`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`Open Library ${response.status} for ${url}`)
  }
  return response.json()
}

async function findExisting(type: string, field: string, value: string) {
  return client.fetch<{_id: string; editorialLocked?: boolean} | null>(
    `*[_type == $type && ${field} == $value][0]{_id, editorialLocked}`,
    {type, value},
  )
}

async function upsert(
  type: string,
  lookupField: string,
  lookupValue: string,
  doc: Record<string, unknown>,
) {
  const existing = await findExisting(type, lookupField, lookupValue)
  if (existing?.editorialLocked) {
    console.log(`skip locked ${type} ${lookupValue}`)
    return existing._id
  }
  if (existing?._id) {
    await client.patch(existing._id).set(doc).commit()
    return existing._id
  }
  const created = await client.create({_type: type, ...doc})
  return created._id
}

async function main() {
  const genreIds: Record<string, string> = {}
  for (const genre of GENRES) {
    const parentRef = genre.parent ? {_type: 'reference', _ref: genreIds[genre.parent]} : undefined
    const id = await upsert('genre', 'slug.current', genre.slug, {
      title: genre.title,
      slug: {_type: 'slug', current: genre.slug},
      parent: parentRef,
    })
    genreIds[genre.slug] = id
  }

  const bookIds: string[] = []
  const fantasyIds: string[] = []

  for (const seed of SEED) {
    try {
      const search = await olJson(
        `https://openlibrary.org/search.json?title=${encodeURIComponent(seed.title)}&author=${encodeURIComponent(seed.author)}&limit=1`,
      )
      const doc = search.docs?.[0]
      if (!doc?.key) {
        console.warn(`No Open Library hit for ${seed.title}`)
        continue
      }
      const workKey = String(doc.key).replace('/works/', '')
      const workJson = await olJson(`https://openlibrary.org/works/${workKey}.json`)
      const authorKey = String(doc.author_key?.[0] || '')
      const authorId = await upsert('author', 'openLibraryAuthorKey', authorKey || seed.author, {
        name: seed.author,
        slug: {_type: 'slug', current: slugify(seed.author)},
        openLibraryAuthorKey: authorKey || undefined,
        provenance: {
          _type: 'sourceProvenance',
          provider: 'openLibrary',
          sourceId: authorKey,
          sourceUrl: authorKey ? `https://openlibrary.org/authors/${authorKey}` : undefined,
          retrievedAt,
          attribution: 'Open Library',
        },
      })

      const description =
        typeof workJson.description === 'string'
          ? workJson.description
          : workJson.description?.value || undefined

      const bookId = await upsert('book', 'openLibraryWorkKey', workKey, {
        title: workJson.title || seed.title,
        slug: {_type: 'slug', current: slugify(workJson.title || seed.title)},
        authors: [seed.author],
        authorReferences: [{_type: 'reference', _ref: authorId, _key: authorId}],
        genres: [{_type: 'reference', _ref: genreIds[seed.genre], _key: seed.genre}],
        description,
        publishedDate: seed.year ? String(seed.year) : undefined,
        openLibraryWorkKey: workKey,
        provenance: {
          _type: 'sourceProvenance',
          provider: 'openLibrary',
          sourceId: workKey,
          sourceUrl: `https://openlibrary.org/works/${workKey}`,
          retrievedAt,
          attribution: 'Open Library',
        },
      })
      bookIds.push(bookId)
      if (seed.genre === 'fantasy') fantasyIds.push(bookId)

      const editionKey = doc.cover_edition_key || doc.edition_key?.[0]
      const isbn13 = doc.isbn?.find((value: string) => value.length === 13)
      if (editionKey) {
        await upsert('edition', 'openLibraryEditionKey', editionKey, {
          title: workJson.title || seed.title,
          book: {_type: 'reference', _ref: bookId},
          isbn13,
          openLibraryEditionKey: editionKey,
          onSaleDate: seed.year ? `${seed.year}-01-01` : undefined,
          isReprint: seed.reprint,
          firstPublicationOfBook: !seed.reprint,
          market: 'US',
          coverOpenLibraryId: editionKey,
          coverUrl: `https://covers.openlibrary.org/b/olid/${editionKey}-L.jpg`,
          provenance: {
            _type: 'sourceProvenance',
            provider: 'openLibrary',
            sourceId: editionKey,
            sourceUrl: `https://openlibrary.org/books/${editionKey}`,
            retrievedAt,
            attribution: 'Cover from Open Library Covers API',
            licenseNote: 'Displayed from covers.openlibrary.org; not re-hosted.',
          },
        })
      }
      await new Promise((resolve) => setTimeout(resolve, 350))
    } catch (error) {
      console.warn(`Failed ${seed.title}:`, error)
    }
  }

  await client.createOrReplace({
    _id: 'siteSettings',
    _type: 'siteSettings',
    tagline: 'A home for everything you read',
    catalogDisclaimer:
      'Everlogue keeps a small, verified catalog. New-release pages show books we have actually imported. This is not a complete record of every book published.',
    ratingMethod:
      'Fantasy by Year ranks books whose first publication year matches the selected year. The score is the average of current Everlogue half-star ratings (0.5–5). A book appears in the ranked list only when it has at least 3 ratings. We do not import or invent Goodreads or other community scores. If too few ratings exist, you may see an empty state or a separately labeled editorial collection.',
    minimumRatingCount: 3,
    openLibraryAttribution: 'Book metadata and cover images from Open Library, used with attribution.',
  })

  const collectionId = await upsert('editorialCollection', 'slug.current', 'forever-fantasy', {
    title: 'Forever fantasy',
    slug: {_type: 'slug', current: 'forever-fantasy'},
    description: 'A starter shelf of verified fantasy and adjacent books. Preview rows link here in full.',
    kind: 'discover',
    workflowStatus: 'proposed',
    books: bookIds.map((id) => ({_type: 'reference', _ref: id, _key: id})),
  })

  await client.patch(collectionId).set({workflowStatus: 'approved'}).commit()

  if (fantasyIds.length) {
    const editorialFantasy = await upsert('editorialCollection', 'slug.current', 'editorial-fantasy-2019', {
      title: 'Editors’ 2019 fantasy shelf',
      slug: {_type: 'slug', current: 'editorial-fantasy-2019'},
      kind: 'fantasyByYear',
      year: 2019,
      editorialLabel: 'Editorial collection — not a community ranking',
      description: 'Shown because this catalog does not yet have enough in-app ratings for a 2019 ranked list.',
      workflowStatus: 'approved',
      books: fantasyIds.slice(0, 6).map((id) => ({_type: 'reference', _ref: id, _key: id})),
    })
    void editorialFantasy
  }

  const clubs = [
    {name: "Reese's Book Club", slug: 'reese', officialUrl: 'https://reesesbookclub.com/'},
    {name: 'Read with Jenna', slug: 'read-with-jenna', officialUrl: 'https://www.today.com/read-with-jenna'},
    {name: "Oprah's Book Club", slug: 'oprah', officialUrl: 'https://www.oprah.com/app/books.html'},
    {name: 'GMA Book Club', slug: 'gma', officialUrl: 'https://www.goodmorningamerica.com/gma-book-club'},
  ]
  for (const club of clubs) {
    const clubId = await upsert('celebrityClub', 'slug.current', club.slug, {
      ...club,
      slug: {_type: 'slug', current: club.slug},
      disclaimer:
        'Everlogue is not affiliated with this organization. Selections appear only when verified from an official source.',
    })
    const existingSelection = await client.fetch<{_id: string} | null>(
      `*[_type == "celebritySelection" && club._ref == $clubId && year == 2026 && month == 9][0]{_id}`,
      {clubId},
    )
    const selectionDoc = {
      club: {_type: 'reference', _ref: clubId},
      year: 2026,
      month: 9,
      books: [],
      workflowStatus: 'approved',
      emptyReason: `No pick listed here because an official ${club.name} selection was not independently verified during import on ${retrievedAt.slice(0, 10)}.`,
    }
    if (existingSelection?._id) {
      await client.patch(existingSelection._id).set(selectionDoc).commit()
    } else {
      await client.create({_type: 'celebritySelection', ...selectionDoc})
    }
  }

  const demoClub = await upsert('communityClub', 'slug.current', 'evermore-readers', {
    name: 'Evermore Readers',
    slug: {_type: 'slug', current: 'evermore-readers'},
    description: 'A complete first club: current read, next-read voting, and a spoiler-aware thread.',
    visibility: 'public',
    isDemoClub: true,
    currentRead: bookIds[0] ? {_type: 'reference', _ref: bookIds[0]} : undefined,
  })

  const demoReader = await client.createIfNotExists({
    _id: 'demo-reader-evermore',
    _type: 'readerProfile',
    clerkUserId: 'demo-not-clerk',
    displayName: 'Evermore Librarian (demo)',
    profileVisibility: 'publicName',
    bio: 'Labeled demo account used only for sample club activity.',
  })

  if (bookIds.length >= 3) {
    const poll = await upsert('poll', 'title', 'What should we read next?', {
      club: {_type: 'reference', _ref: demoClub},
      title: 'What should we read next?',
      status: 'open',
      allowVoteChange: true,
      options: bookIds.slice(1, 4).map((id) => ({_type: 'reference', _ref: id, _key: id})),
    })
    void poll
  }

  const thread = await upsert('discussionThread', 'title', 'Opening thoughts (demo)', {
    club: {_type: 'reference', _ref: demoClub},
    book: bookIds[0] ? {_type: 'reference', _ref: bookIds[0]} : undefined,
    title: 'Opening thoughts (demo)',
    spoilerBoundary: 'unmarked',
    isDemoThread: true,
  })

  const existingDemoPost = await client.fetch<{_id: string} | null>(
    `*[_type == "discussionPost" && isDemoActivity == true && thread._ref == $thread][0]{_id}`,
    {thread},
  )
  if (!existingDemoPost) {
    await client.create({
      _type: 'discussionPost',
      thread: {_type: 'reference', _ref: thread},
      author: {_type: 'reference', _ref: demoReader._id},
      body: 'This is labeled demo activity so it is never mistaken for a genuine reader post.',
      hasSpoilers: false,
      moderationStatus: 'visible',
      isDemoActivity: true,
    })
  }

  console.log(`Imported ${bookIds.length} books into ${projectId}/${dataset}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
