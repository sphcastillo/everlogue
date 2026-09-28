import {defineQuery} from 'next-sanity'

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
  firstPublicationYear,
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
  *[_type == "curatedCollection"] | order(lastSyncedAt desc){
    _id,
    title,
    "slug": slug.current,
    collectionType,
    description,
    curator,
    source,
    totalSelections,
    "books": books | order(selectionNumber desc)[0...24]{
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
    curator,
    source,
    totalSelections,
    "books": books | order(selectionNumber desc){
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
    firstPublicationDate,
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
      curator,
      description,
      "selectionNumber": books[book._ref == ^.^._id][0].selectionNumber
    }
  }
`)

export const GENRES_QUERY = defineQuery(`
  *[_type == "genre"] | order(title asc){
    _id,
    title,
    "slug": slug.current,
    description,
    "parent": parent->{ title, "slug": slug.current }
  }
`)

export const BESTSELLER_SOURCES_QUERY = defineQuery(`
  *[_type == "bestsellerSource"] | order(name asc){
    _id,
    name,
    officialUrl,
    lastVerifiedAt,
    notes
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
