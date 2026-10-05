import {BookClubDiscoveryShowcase} from '../components/BookClubDiscoveryShowcase'
import type { StructureResolver } from 'sanity/structure'
import {
  BookIcon,
  CogIcon,
  DocumentIcon,
  DocumentsIcon,
  StarIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from '@sanity/icons'
import {BookClubImportsPane} from '../components/BookClubImportsPane'
import {
  FROM_BOOK_CLUB,
  FROM_GOODREADS,
  FROM_READER_SEARCH,
  PENDING_CATALOG_REVIEW,
} from '../lib/catalog-request-filters'

const SINGLETONS = ['siteSettings']
const SPOTLIGHT_CLUBS = [
  { title: 'GMA Book Club', documentId: 'curatedCollection.gma-book-club' },
  { title: "Oprah's Book Club", documentId: 'curatedCollection.oprahs-book-club' },
  { title: 'Read with Jenna', documentId: 'curatedCollection.read-with-jenna' },
  { title: "Reese's Book Club", documentId: 'curatedCollection.reeses-book-club' },
]

export const structure: StructureResolver = (S, context) =>
  S.list()
    .title('Everlogue')
    .items([
      S.documentTypeListItem('companionUsage').title('Companion usage'),
      S.listItem()
        .title('Site settings')
        .icon(CogIcon)
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
      S.listItem().title('Book Club Watch').icon(BookIcon).child(
        S.list().title('Book Club Watch').items([
          ...[
            {title: 'Review queue', filter: 'status in ["discovered", "needs_review"]'},
            {title: 'Approved', filter: 'status == "approved"'},
            {title: 'Published history', filter: 'status == "published"'},
            {title: 'Rejected discoveries', filter: 'status == "rejected"'},
          ].map(({title, filter}) => S.listItem().title(title).child(
            S.documentTypeList('bookClubDiscovery').title(title)
              .filter('_type == "bookClubDiscovery" && ' + filter)
              .defaultOrdering([{field: 'discoveredAt', direction: 'desc'}])
              .child(id => S.document().documentId(id).schemaType('bookClubDiscovery').views([S.view.component(BookClubDiscoveryShowcase).title('Discovery')])),
          )),
          S.documentTypeListItem('bookClubWatchRun').title('Run history'),
        ]),
      ),
      S.divider(),
      S.listItem()
        .title('Book Archive')
        .icon(BookIcon)
        .child(
          S.list()
            .title('Book Archive')
            .items([
              S.listItem()
                .id('books')
                .title('Books')
                .icon(BookIcon)
                .child(async () => {
                  const client = context.getClient({apiVersion: '2026-02-01'})
                  const count = await client.fetch<number>(
                    `count(*[_type == "book" && !(_id in path("drafts.**"))])`,
                  )
                  return S.documentTypeList('book').title(`Books · ${count}`)
                }),
              S.documentTypeListItem('edition').title('Editions'),
              S.listItem().title('Editions needing covers').child(
                S.documentTypeList('edition').title('Editions needing covers')
                  .filter('_type == "edition" && needsCover == true && !defined(coverOverride.asset)'),
              ),
              S.documentTypeListItem('author').title('Authors').icon(UserIcon),
              S.documentTypeListItem('bookSeries').title('Series'),
              S.listItem()
                .id('genres')
                .title('Genres')
                .icon(TagIcon)
                .child(async () => {
                  const client = context.getClient({apiVersion: '2026-02-01'})
                  const count = await client.fetch<number>(
                    `count(*[_type == "genre" && !(_id in path("drafts.**"))])`,
                  )
                  return S.documentTypeList('genre').title(`Genres · ${count}`)
                }),
              S.divider(),
              S.documentTypeListItem('catalogImportIdentity').title('Catalog import identity'),
              S.listItem()
                .id('engaged-but-incomplete')
                .title('Engaged but incomplete')
                .icon(BookIcon)
                .child(async () => {
                  const client = context
                    .getClient({apiVersion: '2026-02-01'})
                    .withConfig({perspective: 'drafts'})
                  const filter =
                    '_type == "book" && (defined(coverOverride.asset) || defined(knowledgeSources[0])) && catalogReviewStatus != "reviewed"'
                  const count = await client.fetch<number>(
                    `count(*[${filter}])`,
                  )
                  return S.documentTypeList('book')
                    .title(`Engaged but incomplete · ${count}`)
                    .filter(filter)
                    .defaultOrdering([{field: '_updatedAt', direction: 'desc'}])
                }),
              S.listItem()
                .id('marked-as-reviewed')
                .title('Marked as reviewed')
                .icon(BookIcon)
                .child(async () => {
                  const client = context
                    .getClient({apiVersion: '2026-02-01'})
                    .withConfig({perspective: 'drafts'})
                  const filter = '_type == "book" && catalogReviewStatus == "reviewed"'
                  const count = await client.fetch<number>(
                    `count(*[${filter}])`,
                  )
                  return S.documentTypeList('book')
                    .title(`Marked as reviewed · ${count}`)
                    .filter(filter)
                    .defaultOrdering([{field: '_updatedAt', direction: 'desc'}])
                }),
            ]),
        ),
      S.listItem()
        .title('Collections')
        .icon(DocumentIcon)
        .child(
          S.list()
            .title('Collections')
            .items([
              S.listItem()
                .title('The Book Club Spotlight')
                .icon(StarIcon)
                .child(
                  S.list()
                    .title('The Book Club Spotlight')
                    .items(SPOTLIGHT_CLUBS.map(({ title, documentId }) =>
                      S.listItem()
                        .id(documentId)
                        .title(title)
                        .icon(BookIcon)
                        .child(S.document().schemaType('curatedCollection').documentId(documentId).title(title)),
                    )),
                ),
            ]),
        ),
      S.listItem()
        .title('Community (private)')
        .icon(UsersIcon)
        .child(
          S.list()
            .title('Reader data — handle with care')
            .items([
              S.documentTypeListItem('communityClub').title('Community clubs'),
              S.documentTypeListItem('clubMembership').title('Memberships'),
              S.documentTypeListItem('poll').title('Polls'),
              S.documentTypeListItem('discussionThread').title('Threads'),
              S.documentTypeListItem('readerProfile').title('Reader profiles'),
              S.divider(),
              S.listItem()
                .id('reader-ratings')
                .title('Reader ratings')
                .icon(StarIcon)
                .child(
                  S.documentTypeList('rating')
                    .title('Reader ratings')
                    .defaultOrdering([{field: '_updatedAt', direction: 'desc'}]),
                ),
              S.listItem()
                .id('reader-reviews')
                .title('Reader reviews')
                .icon(DocumentsIcon)
                .child(
                  S.list()
                    .title('Reader reviews')
                    .items([
                      S.listItem()
                        .id('reader-reviews-all')
                        .title('All reviews')
                        .child(
                          S.documentTypeList('review')
                            .title('All reviews')
                            .defaultOrdering([{field: '_updatedAt', direction: 'desc'}]),
                        ),
                      S.listItem()
                        .id('reader-reviews-public')
                        .title('Public on the site')
                        .child(
                          S.documentTypeList('review')
                            .title('Public on the site')
                            .filter('_type == "review" && visibility == "public" && moderationStatus != "hidden"')
                            .defaultOrdering([{field: '_updatedAt', direction: 'desc'}]),
                        ),
                      S.listItem()
                        .id('reader-reviews-hidden')
                        .title('Hidden')
                        .child(
                          S.documentTypeList('review')
                            .title('Hidden')
                            .filter('_type == "review" && moderationStatus == "hidden"')
                            .defaultOrdering([{field: '_updatedAt', direction: 'desc'}]),
                        ),
                    ]),
                ),
            ]),
        ),
      ...S.documentTypeListItems().filter((item) => {
        const id = item.getId()
        return (
          !!id &&
          !SINGLETONS.includes(id) &&
          ![
            'bookClubDiscovery',
            'bookClubWatchRun',
            'book',
            'edition',
            'author',
            'bookSeries',
            'genre',
            'editorialCollection',
            'curatedCollection',
            'celebrityClub',
            'celebritySelection',
            'communityClub',
            'clubMembership',
            'poll',
            'discussionThread',
            'readerProfile',
            'companionConversation',
            'companionUsage',
            'companionQuota',
            'rating',
            'review',
            'shelf',
            'shelfEntry',
            'readingProgress',
            'vote',
            'discussionPost',
            'sourceProvenance',
            'ratingStats',
            'catalogImportIdentity',
            'catalogImportFailure',
          ].includes(id)
        )
      }),
      S.divider(),
      S.listItem()
        .title('Everlogue Catalog Requests')
        .icon(DocumentsIcon)
        .child(
          S.list()
            .title('Everlogue Catalog Requests')
            .items([
              catalogRequestList(S, context, {
                id: 'catalog-requests-all',
                title: 'Needs review',
                filter: `_type == "book" && ${PENDING_CATALOG_REVIEW} && (${FROM_READER_SEARCH} || ${FROM_GOODREADS} || ${FROM_BOOK_CLUB})`,
              }),
              catalogRequestList(S, context, {
                id: 'catalog-requests-search',
                title: 'Reader-added books',
                filter: `_type == "book" && ${PENDING_CATALOG_REVIEW} && ${FROM_READER_SEARCH}`,
              }),
              catalogRequestList(S, context, {
                id: 'catalog-requests-goodreads',
                title: 'Goodreads imports',
                filter: `_type == "book" && ${PENDING_CATALOG_REVIEW} && ${FROM_GOODREADS}`,
              }),
              S.listItem()
                .id('catalog-requests-failed-imports')
                .title('Failed to Upload Import')
                .icon(BookIcon)
                .child(
                  S.documentTypeList('catalogImportFailure')
                    .title('Failed to Upload Import')
                    .filter('_type == "catalogImportFailure" && !defined(resolvedAt)')
                    .defaultOrdering([{field: 'lastFailedAt', direction: 'desc'}]),
                ),
              S.listItem()
                .id('catalog-requests-book-clubs')
                .title('Bookclub imports')
                .icon(BookIcon)
                .child(
                  S.component(BookClubImportsPane)
                    .id('bookclub-imports-pane')
                    .title('Bookclub imports'),
                ),
            ]),
        ),
    ])

function catalogRequestList(
  S: Parameters<StructureResolver>[0],
  context: Parameters<StructureResolver>[1],
  {id, title, filter}: {id: string; title: string; filter: string},
) {
  return S.listItem()
    .id(id)
    .title(title)
    .icon(BookIcon)
    .child(async () => {
      const client = context.getClient({apiVersion: '2026-02-01'})
      const count = await client.fetch<number>(`count(*[${filter} && !(_id in path("drafts.**"))])`)
      return S.documentTypeList('book')
        .title(`${title} · ${count}`)
        .filter(filter)
        .defaultOrdering([{field: '_createdAt', direction: 'desc'}])
    })
}
