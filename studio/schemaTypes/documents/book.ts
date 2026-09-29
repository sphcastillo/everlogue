import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons'
import {BookClubsInput} from '../../components/BookClubsInput'

// Shared catalog foundation for club selections, reader libraries, and editions.
export const book = defineType({
  name: 'book',
  title: 'Book',
  type: 'document',
  icon: BookIcon,
  fieldsets: [{name: 'import', title: 'Import metadata', options: {collapsible: true, collapsed: true}}],
  fields: [
    defineField({name: 'title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'catalogReviewStatus', title: 'Catalog review', type: 'string',
      description: 'Reader-added books are available on shelves immediately. Review the metadata, then mark Reviewed and publish to clear the review queue.',
      options: {list: [{title: 'Needs review', value: 'needsReview'}, {title: 'Reviewed', value: 'reviewed'}], layout: 'radio'},
    }),
    defineField({
      name: 'catalogSource', title: 'Added from', type: 'string', readOnly: true,
      options: {list: [{title: 'Reader search', value: 'readerSearch'}]},
      fieldset: 'import',
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
    defineField({
      name: 'clubs',
      title: 'Book clubs',
      type: 'array',
      description: 'Club lists this title belongs on. Checking a club also adds it to that club’s selections; unchecking removes it.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'curatedCollection'}], options: {disableNew: true}})],
      validation: (rule) => rule.unique(),
      components: {input: BookClubsInput},
    }),
    defineField({name: 'firstPublicationYear', type: 'number', validation: (rule) => rule.integer().min(1000).max(2100)}),
    defineField({
      name: 'firstPublicationDate', type: 'date',
      validation: (rule) => rule.custom((date, {document}) => {
        if (!date || !document?.firstPublicationYear) return true
        return Number(date.slice(0, 4)) === document.firstPublicationYear || 'The date must match the first publication year.'
      }),
    }),
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
    defineField({
      name: 'cover', title: 'Provider cover', type: 'object',
      fields: [
        defineField({name: 'url', type: 'url'}),
        defineField({name: 'source', type: 'string'}),
      ],
    }),
    defineField({name: 'edition', type: 'reference', to: [{type: 'edition'}]}),
    defineField({name: 'needsCover', type: 'boolean'}),
    defineField({name: 'isbn10', title: 'ISBN-10', type: 'string'}),
    defineField({name: 'isbn13', title: 'ISBN-13', type: 'string'}),
    defineField({name: 'publisher', type: 'string'}),
    defineField({name: 'publishedDate', type: 'string', description: 'Preserves year-only, year-month, or full-date precision.'}),
    defineField({name: 'pageCount', type: 'number'}),
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
  preview: {
    select: {title: 'title', author: 'authors.0', media: 'coverOverride'},
    prepare({title, author, media}) {
      return {title, subtitle: author, media}
    },
  },
})
