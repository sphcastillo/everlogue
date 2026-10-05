import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons'
import {BookPreview} from '../../components/BookPreview'
import {CatalogOriginInput} from '../../components/CatalogOriginInput'

// Shared catalog foundation for club selections, reader libraries, and editions.
export const book = defineType({
  name: 'book',
  title: 'Book',
  type: 'document',
  icon: BookIcon,
  fieldsets: [{name: 'import', title: 'Import metadata', options: {collapsible: true, collapsed: true}}],
  fields: [
    defineField({name: 'watchIdentity', type: 'string', readOnly: true, hidden: true}),
    defineField({name: 'watchDiscovery', type: 'reference', to: [{type: 'bookClubDiscovery'}], readOnly: true, fieldset: 'import'}),
    defineField({name: 'title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'catalogReviewStatus', title: 'Catalog review', type: 'string',
      description: 'Books added from search, a Goodreads import, or a book club import stay on the reader’s shelves when the import succeeds. Failed imports wait here as catalog books — edit, publish, then add them to the waiting reader’s shelf.',
      options: {list: [{title: 'Needs review', value: 'needsReview'}, {title: 'Reviewed', value: 'reviewed'}], layout: 'radio'},
    }),
    defineField({
      name: 'catalogSource',
      title: 'Catalog origin',
      type: 'string',
      readOnly: true,
      description: 'How this book entered the catalog, and the club list it sits on when it came from a book club import or was added to a club.',
      options: {
        list: [
          {title: 'Reader search', value: 'readerSearch'},
          {title: 'Goodreads import', value: 'goodreadsImport'},
          {title: 'Book club import', value: 'bookClubImport'},
        ],
      },
      components: {input: CatalogOriginInput},
    }),
    defineField({
      name: 'pendingImportPlacements',
      title: 'Waiting readers',
      description: 'Readers whose Goodreads import could not add this title yet. Edit the catalog fields, publish, then add the book to their shelf.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'pendingImportPlacement',
          fields: [
            defineField({name: 'reader', type: 'reference', to: [{type: 'readerProfile'}]}),
            defineField({name: 'readerName', title: 'Reader', type: 'string'}),
            defineField({
              name: 'shelfStatus',
              title: 'Intended shelf',
              type: 'string',
              options: {
                list: [
                  {title: 'Read', value: 'finished'},
                  {title: 'Currently reading', value: 'currentlyReading'},
                  {title: 'Want to read', value: 'wantToRead'},
                ],
              },
            }),
            defineField({name: 'rating', type: 'number'}),
            defineField({name: 'addedAt', title: 'Date added', type: 'string'}),
            defineField({name: 'finishedAt', title: 'Date read', type: 'string'}),
            defineField({name: 'readCount', title: 'Times read', type: 'number'}),
            defineField({name: 'message', title: 'Why it failed', type: 'text', rows: 2}),
          ],
          preview: {
            select: {readerName: 'readerName', shelfStatus: 'shelfStatus'},
            prepare({readerName, shelfStatus}) {
              const shelf =
                shelfStatus === 'finished'
                  ? 'Read'
                  : shelfStatus === 'currentlyReading'
                    ? 'Currently reading'
                    : shelfStatus === 'wantToRead'
                      ? 'Want to read'
                      : 'Shelf unknown'
              return {title: readerName || 'Reader', subtitle: shelf}
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'knowledgeSources',
      title: 'Knowledge sources',
      type: 'array',
      description: 'Add source links here in Studio when you have them — publisher pages, club posts, Wikipedia, interviews, and similar.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'knowledgeSource',
          fields: [
            defineField({name: 'label', type: 'string', description: 'Optional. Defaults to the URL if left blank.'}),
            defineField({
              name: 'url',
              type: 'url',
              validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
            }),
          ],
          preview: {
            select: {title: 'label', subtitle: 'url'},
            prepare({title, subtitle}) {
              return {title: title || subtitle || 'Source link', subtitle: title ? subtitle : undefined}
            },
          },
        }),
      ],
    }),
    defineField({name: 'subtitle', type: 'string'}),
    defineField({name: 'authors', type: 'array', of: [defineArrayMember({type: 'string'})]}),
    defineField({
      name: 'authorReferences', type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'author'}]})],
      description: 'Linked author profiles, when available. Display names are stored in Authors.',
    }),
    defineField({name: 'slug', type: 'slug', options: {source: 'title'}}),
    defineField({name: 'slugAliases', type: 'array', of: [defineArrayMember({type: 'string'})], readOnly: true, fieldset: 'import'}),
    defineField({name: 'description', type: 'text', rows: 5}),
    defineField({name: 'genres', type: 'array', of: [defineArrayMember({type: 'reference', to: [{type: 'genre'}]})]}),
    defineField({name: 'ratingStats', type: 'ratingStats', readOnly: true}),
    defineField({name: 'editorialLocked', type: 'boolean', initialValue: false, description: 'Protect reviewed metadata from automatic updates.'}),
    defineField({
      name: 'coverOverride',
      title: 'Manual cover',
      type: 'image',
      options: {hotspot: true},
      description: 'When set, this image is used everywhere in the app. Provider and edition covers are ignored.',
      fields: [defineField({name: 'alt', title: 'Alternative text', type: 'string'})],
    }),

    defineField({name: 'isbn13', title: 'ISBN-13', type: 'string'}),
    defineField({name: 'publisher', type: 'string'}),
    defineField({name: 'publishedDate', type: 'string', description: 'Preserves year-only, year-month, or full-date precision.'}),
    defineField({name: 'pageCount', type: 'number'}),
    defineField({
      name: 'isStandalone',
      title: 'Standalone book',
      type: 'boolean',
      initialValue: true,
      description: 'Books default to standalone. Turn this off to add series information.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'series',
      title: 'Series',
      type: 'object',
      description: 'Search an existing series or create a new one, then set this book’s place in it.',
      hidden: ({document}) => document?.isStandalone !== false,
      fields: [
        defineField({
          name: 'bookSeries',
          title: 'Series',
          type: 'reference',
          to: [{type: 'bookSeries'}],
          options: {disableNew: false},
          validation: (rule) =>
            rule.custom((value, context) => {
              const parent = context.parent as {name?: string} | undefined
              return value || parent?.name?.trim() ? true : 'Choose a series'
            }),
        }),
        defineField({
          name: 'name',
          title: 'Series name',
          type: 'string',
          deprecated: {
            reason: 'Use the Series lookup. This name stays on older books until they are linked.',
          },
          readOnly: true,
          hidden: ({parent}) => Boolean(parent?.bookSeries) || !parent?.name,
        }),
        defineField({
          name: 'position',
          type: 'number',
          description: 'Place in the series. Use halves for prequels and in-between books — 0.5, 1, 1.5, 2.',
          validation: (rule) =>
            rule.required().min(0.5).custom(async (value, context) => {
              if (typeof value !== 'number' || !Number.isFinite(value)) return 'Required'
              if (Math.round(value * 2) !== value * 2) {
                return 'Use a whole or half position, like 0.5, 1, or 1.5'
              }
              const parent = context.parent as {bookSeries?: {_ref?: string}; name?: string} | undefined
              const seriesId = parent?.bookSeries?._ref
              const seriesName = parent?.name?.trim() || ''
              if (!seriesId && !seriesName) return true
              const bookId = String(context.document?._id || '').replace(/^drafts\./, '')
              const client = context.getClient({apiVersion: '2026-02-01'})
              const taken = await client.fetch<number>(
                `count(*[_type == "book" && !(_id in path("drafts.**")) && _id != $bookId && series.position == $position && (
                  ($seriesId != "" && series.bookSeries._ref == $seriesId) ||
                  ($seriesId == "" && defined($seriesName) && !defined(series.bookSeries) && lower(series.name) == lower($seriesName))
                )])`,
                {bookId, position: value, seriesId: seriesId || '', seriesName},
              )
              return taken === 0 || `Position ${value} is already used in this series`
            }),
        }),
      ],
    }),
    defineField({name: 'categories', type: 'array', of: [defineArrayMember({type: 'string'})]}),
    defineField({name: 'language', type: 'string'}),
    defineField({name: 'googleBooksId', title: 'Google Books ID', type: 'string', readOnly: true, fieldset: 'import'}),
    defineField({name: 'goodreadsBookId', title: 'Goodreads book ID', type: 'string', readOnly: true, fieldset: 'import'}),
    defineField({name: 'openLibraryWorkKey', title: 'Open Library work key', type: 'string', readOnly: true, fieldset: 'import'}),
    defineField({name: 'importKey', type: 'string', readOnly: true, hidden: true}),
    defineField({name: 'legacyWorkIds', title: 'Previous catalog IDs', type: 'array', of: [defineArrayMember({type: 'string'})], readOnly: true, hidden: true}),
    defineField({name: 'provenance', type: 'sourceProvenance', fieldset: 'import'}),
    defineField({name: 'googleAverageRating', type: 'number', readOnly: true, fieldset: 'import'}),
    defineField({name: 'googleRatingsCount', type: 'number', readOnly: true, fieldset: 'import'}),
    defineField({
      name: 'externalRatings', type: 'object', readOnly: true, fieldset: 'import',
      fields: [defineField({
        name: 'googleBooks', type: 'object',
        fields: [defineField({name: 'averageRating', type: 'number'}), defineField({name: 'ratingsCount', type: 'number'})],
      })],
    }),
    defineField({
      name: 'externalLinks', type: 'object', fieldset: 'import',
      fields: [
        defineField({name: 'googleBooks', type: 'url'}),
        defineField({name: 'googlePreview', type: 'url'}),
        defineField({name: 'googleCanonical', type: 'url'}),
      ],
    }),
    defineField({name: 'metadataSource', type: 'string', readOnly: true, fieldset: 'import'}),
    defineField({name: 'metadataImportedAt', type: 'datetime', readOnly: true, fieldset: 'import'}),
    defineField({
      name: 'dataSource', type: 'object', readOnly: true, fieldset: 'import',
      fields: [
        defineField({name: 'provider', type: 'string'}),
        defineField({name: 'providerId', type: 'string'}),
        defineField({name: 'importedAt', type: 'datetime'}),
      ],
    }),
  ],
  components: {preview: BookPreview},
  preview: {
    select: {
      title: 'title',
      author: 'authors.0',
      authorRef: 'authorReferences.0.name',
      media: 'coverOverride',
      catalogReviewStatus: 'catalogReviewStatus',
      catalogSource: 'catalogSource',
      importKey: 'importKey',
      bookId: '_id',
    },
    prepare({title, author, authorRef, media, catalogReviewStatus, catalogSource, importKey, bookId}) {
      const authorName = [author, authorRef].find((value) => typeof value === 'string' && value.trim())
      return {
        title,
        subtitle: authorName,
        author: authorName,
        media,
        catalogReviewStatus,
        catalogSource,
        importKey,
        bookId,
      }
    },
  },
})
