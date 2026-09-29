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
      S.listItem()
        .title('Site settings')
        .icon(CogIcon)
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
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
              S.documentTypeListItem('genre').title('Genres').icon(TagIcon),
              S.divider(),
              S.documentTypeListItem('catalogImportIdentity').title('Catalog import identity'),
              S.listItem()
                .id('engaged-but-incomplete')
                .title('Engaged but incomplete')
                .icon(BookIcon)
                .child(async () => {
                  const client = context.getClient({apiVersion: '2026-02-01'})
                  const filter =
                    '_type == "book" && defined(coverOverride.asset) && catalogReviewStatus != "reviewed"'
                  const count = await client.fetch<number>(
                    `count(*[${filter} && !(_id in path("drafts.**"))])`,
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
                  const client = context.getClient({apiVersion: '2026-02-01'})
                  const filter = '_type == "book" && catalogReviewStatus == "reviewed"'
                  const count = await client.fetch<number>(
                    `count(*[${filter} && !(_id in path("drafts.**"))])`,
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
            ]),
        ),
      ...S.documentTypeListItems().filter((item) => {
        const id = item.getId()
        return (
          !!id &&
          !SINGLETONS.includes(id) &&
          ![
            'book',
            'edition',
            'author',
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
              S.listItem()
                .title('Reader-added books')
                .icon(BookIcon)
                .child(
                  S.documentTypeList('book')
                    .title('Reader-added books — needs review')
                    .filter('_type == "book" && catalogSource == "readerSearch" && catalogReviewStatus == "needsReview"')
                    .defaultOrdering([{ field: '_createdAt', direction: 'desc' }]),
                ),
            ]),
        ),
    ])
