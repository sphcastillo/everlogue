import {defineQuery} from 'next-sanity'
import {searchCatalogFilter} from '../lib/search-catalog'

export const editionCoverFields = /* groq */ `
  _id, isbn10, isbn13, cover, coverUrl, coverOpenLibraryId, needsCover,
  coverOverride{asset->{_id, url}, alt, hotspot, crop}
`

export const bookCoverProjection = /* groq */ `{
  ...coalesce(
    (^.featuredEditions[]->)[book._ref == ^._id][0]{${editionCoverFields}},
    edition->{${editionCoverFields}},
    select(defined(cover.url) || defined(coverUrl) => @{${editionCoverFields}}),
    *[_type == "edition" && book._ref == ^._id] | order(defined(coverOverride.asset) desc, defined(cover.url) desc, defined(coverUrl) desc, onSaleDate desc)[0]{${editionCoverFields}},
    @{${editionCoverFields}}
  ),
  ...select(defined(coverOverride.asset) => {
    "coverOverride": coverOverride{asset->{_id, url}, alt, hotspot, crop}
  })
}`

export const bookCardFields = /* groq */ `
  _id,
  title,
  "slug": coalesce(slug.current, _id),
  publishedDate,
  description,
  ratingStats,
  "authors": authors,
  "genres": genres[]->{ _id, title, "slug": slug.current, "parentSlug": parent->slug.current },
  "cover": ${bookCoverProjection}
`

export const SITE_SETTINGS_QUERY = defineQuery(`
  *[_id == "siteSettings"][0]{
    tagline,
    catalogDisclaimer,
    ratingMethod,
    minimumRatingCount,
    openLibraryAttribution
  }
`)

export const DISCOVER_COLLECTIONS_QUERY = defineQuery(`
  *[_type == "editorialCollection" && workflowStatus == "approved" && kind == "discover"] | order(title asc){
    _id,
    title,
    "slug": slug.current,
    description,
    "books": books[]->{ ${bookCardFields} }
  }
`)

export const curatedBookFields = /* groq */ `
  _id,
  title,
  authors,
  "slug": coalesce(slug.current, _id),
  googleBooksId,
  publishedDate,
  isbn10, isbn13, coverOverride{asset->{_id, url}, alt, hotspot, crop},
  "edition": ${bookCoverProjection},
  cover
`

export const CURATED_COLLECTIONS_QUERY = defineQuery(`
  *[_type == "curatedCollection"] | order(coalesce(sortOrder, 999) asc, title asc){
    _id,
    title,
    "slug": slug.current,
    collectionType,
    description,
    image{asset->{_id, url}, alt, hotspot, crop},
    curator,
    instagramUrl,
    source,
    totalSelections,
    "books": books[]{
        selectionNumber,
        month,
        year,
        selectionDate,
        "book": book->{ ${curatedBookFields} }
      }
  }
`)

export const CURATED_COLLECTION_BY_SLUG_QUERY = defineQuery(`
  *[_type == "curatedCollection" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    collectionType,
    description,
    image{asset->{_id, url}, alt, hotspot, crop},
    curator,
    instagramUrl,
    source,
    totalSelections,
    "books": books[]{
        selectionNumber,
        month,
        year,
        selectionDate,
        "book": book->{ ${curatedBookFields}, description }
      }
  }
`)

export const COLLECTION_BY_SLUG_QUERY = defineQuery(`
  *[_type == "editorialCollection" && slug.current == $slug && workflowStatus == "approved"][0]{
    _id,
    title,
    "slug": slug.current,
    description,
    editorialLabel,
    kind,
    "books": books[]->{ ${bookCardFields} }
  }
`)

export const BOOK_BY_SLUG_QUERY = defineQuery(`
  *[_type == "book" && (slug.current == $slug || _id == $slug || $slug in slugAliases || $slug in legacyWorkIds)][0]{
    ${bookCardFields},
    subtitle,
    openLibraryWorkKey,
    provenance,
    "editions": *[_type == "edition" && book._ref == ^._id] | order(onSaleDate desc){
      _id,
      title,
      isbn13,
      format,
      market,
      publisher,
      onSaleDate,
      isReprint,
      firstPublicationOfBook,
      ${editionCoverFields}
    },
    "clubs": *[_type == "curatedCollection" && references(^._id)] | order(lastSyncedAt desc){
      title,
      "slug": slug.current,
      "href": "/collections/" + slug.current,
      curator,
      description,
      "selectionNumber": books[book._ref == ^.^._id][0].selectionNumber
    },
    "celebrityClubs": *[_type == "celebritySelection" && references(^._id)] | order(year desc, month desc){
      "title": club->name,
      "slug": club->slug.current,
      "href": "/clubs/" + club->slug.current
    }
  }
`)

export const BOOK_BY_GOOGLE_ID_QUERY = defineQuery(`
  *[${searchCatalogFilter}][0]{
    ${bookCardFields},
    "clubs": *[_type == "curatedCollection" && references(^._id)] | order(lastSyncedAt desc){
      title,
      "slug": slug.current,
      "href": "/collections/" + slug.current,
      curator,
      description,
      "selectionNumber": books[book._ref == ^.^._id][0].selectionNumber
    },
    "celebrityClubs": *[_type == "celebritySelection" && references(^._id)] | order(year desc, month desc){
      "title": club->name,
      "slug": club->slug.current,
      "href": "/clubs/" + club->slug.current
    }
  }
`)

export const GENRES_QUERY = defineQuery(`
  *[_type == "genre"] | order(title asc){
    _id,
    title,
    "slug": slug.current,
    description,
    "parent": parent->{ title, "slug": slug.current },
    "bookCount": count(*[_type == "book" && references(^._id)])
  }
`)

export const CELEBRITY_CLUBS_QUERY = defineQuery(`
  *[_type == "celebrityClub"] | order(name asc){
    _id,
    name,
    "slug": slug.current,
    officialUrl,
    disclaimer,
    "selections": *[_type == "celebritySelection" && club._ref == ^._id && workflowStatus == "approved"] | order(year desc, month desc){
      _id,
      year,
      month,
      sourceUrl,
      verifiedAt,
      emptyReason,
      "books": books[]->{ ${bookCardFields} }
    }
  }
`)

export const CELEBRITY_CLUB_BY_SLUG_QUERY = defineQuery(`
  *[_type == "celebrityClub" && slug.current == $slug][0]{
    _id,
    name,
    "slug": slug.current,
    officialUrl,
    disclaimer,
    "selections": *[_type == "celebritySelection" && club._ref == ^._id && workflowStatus == "approved"] | order(year desc, month desc){
      _id,
      year,
      month,
      sourceUrl,
      verifiedAt,
      emptyReason,
      "books": books[]->{ ${bookCardFields} }
    }
  }
`)

export const COMMUNITY_CLUBS_QUERY = defineQuery(`
  *[_type == "communityClub" && visibility == "public"] | order(name asc){
    _id,
    name,
    "slug": slug.current,
    description,
    isDemoClub,
    "currentRead": currentRead->{ ${bookCardFields} }
  }
`)

export const COMMUNITY_CLUB_BY_SLUG_QUERY = defineQuery(`
  *[_type == "communityClub" && slug.current == $slug][0]{
    _id,
    name,
    "slug": slug.current,
    description,
    visibility,
    isDemoClub,
    "currentRead": currentRead->{ ${bookCardFields} }
  }
`)

export const SHELF_PICK_GENRES = {
  strange: [
    'Magical Realism',
    'Speculative Fiction',
    'Gothic Fiction',
    'Gothic Fantasy',
    'Ghost Story',
    'Supernatural Fiction',
    'Occult Fiction',
    'Contemporary Fantasy',
  ],
  feelings: [
    'Family Drama',
    'Family Fiction',
    'Family Saga',
    'Relationship Fiction',
    'Coming-of-age',
    'Coming-Of-Age Story',
    'Romantic Drama',
    'Sad-Girl Fiction',
  ],
  short: [
    'Literary Fiction',
    'Literary Thriller',
    'Psychological Thriller',
    'Mystery',
    'Horror',
    'Satire',
    'Dark Comedy',
    'Short Stories',
    'Essays',
  ],
} as const

const shelfPickBookFields = /* groq */ `
  ${bookCardFields},
  pageCount
`

export const SHELF_PICKS_QUERY = defineQuery(`{
  "collections": *[_type == "editorialCollection" && workflowStatus == "approved" && slug.current in ["a-little-strange", "big-feelings", "short-and-sharp"]]{
    "slug": slug.current,
    "books": books[defined(@->coverOverride.asset)][0...40]->{ ${shelfPickBookFields} }
  },
  "strange": *[_type == "book" && defined(coverOverride.asset) && count((genres[]->title)[@ in $strangeGenres]) > 0] | order(_updatedAt desc)[0...40]{ ${shelfPickBookFields} },
  "feelings": *[_type == "book" && defined(coverOverride.asset) && count((genres[]->title)[@ in $feelingsGenres]) > 0] | order(_updatedAt desc)[0...40]{ ${shelfPickBookFields} },
  "short": *[_type == "book" && defined(coverOverride.asset) && pageCount > 0 && pageCount <= 250 && count((genres[]->title)[@ in $shortGenres]) > 0] | order(pageCount asc)[0...40]{ ${shelfPickBookFields} }
}`)

export const FOR_YOU_BOOKS_QUERY = defineQuery(`{
  "hasLibrary": count(*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["wantToRead", "currentlyReading", "finished"]]) > 0,
  "taste": {
    "genres": array::unique(*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["wantToRead", "currentlyReading", "finished"]].book->genres[]->title),
    "lovedGenres": array::unique(*[_type == "rating" && reader._ref == $readerId && value >= 4].book->genres[]->title),
    "authors": array::unique(*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["wantToRead", "currentlyReading", "finished"]].book->authors[])
  },
  "books": *[
    _type == "book" &&
    defined(coverOverride.asset) &&
    !(_id in *[_type == "shelfEntry" && shelf->owner._ref == $readerId].book._ref) &&
    (
      count((genres[]->title)[@ in array::unique(*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["wantToRead", "currentlyReading", "finished"]].book->genres[]->title)]) > 0 ||
      count(authors[@ in array::unique(*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["wantToRead", "currentlyReading", "finished"]].book->authors[])]) > 0
    )
  ] | order(
    count((genres[]->title)[@ in array::unique(*[_type == "rating" && reader._ref == $readerId && value >= 4].book->genres[]->title)]) desc,
    count((genres[]->title)[@ in array::unique(*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["wantToRead", "currentlyReading", "finished"]].book->genres[]->title)]) desc,
    count(authors[@ in array::unique(*[_type == "shelfEntry" && shelf->owner._ref == $readerId && shelf->kind in ["wantToRead", "currentlyReading", "finished"]].book->authors[])]) desc,
    coalesce(ratingStats.count, 0) desc
  )[0...40]{ ${shelfPickBookFields} }
}`)

export const PICK_SHELF_STATUSES_QUERY = defineQuery(`
  *[_type == "shelfEntry" && shelf->owner._ref == $readerId && book._ref in $bookIds && shelf->kind in ["wantToRead", "currentlyReading", "finished"]]{
    "bookId": book._ref,
    "status": shelf->kind
  }
`)

export const TASTE_TRAVELS_QUERY = defineQuery(`{
  "clubCount": count(*[_type == "communityClub" && visibility == "public"]),
  "reviews": *[_type == "review" && visibility == "public" && moderationStatus == "visible"] | order(_createdAt desc)[0...12]{
    _id,
    _createdAt,
    title,
    body,
    "name": reader->displayName,
    "spaceColor": reader->spaceColor,
    "bookTitle": book->title,
    "bookSlug": coalesce(book->slug.current, book->_id)
  },
  "posts": *[_type == "discussionPost" && moderationStatus == "visible" && thread->club->visibility == "public"] | order(_createdAt desc)[0...12]{
    _id,
    _createdAt,
    body,
    isDemoActivity,
    "name": author->displayName,
    "spaceColor": author->spaceColor,
    "clubName": thread->club->name,
    "clubSlug": thread->club->slug.current,
    "bookTitle": thread->club->currentRead->title,
    "bookSlug": coalesce(thread->club->currentRead->slug.current, thread->club->currentRead->_id)
  }
}`)
