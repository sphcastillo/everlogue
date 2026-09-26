import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons'

export const edition = defineType({
  name: 'edition',
  title: 'Edition',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({name: 'importKey', type: 'string', hidden: true, readOnly: true}),
    defineField({name: 'googleBooksId', type: 'string', readOnly: true}),
    defineField({name: 'coverCheckedAt', type: 'datetime', readOnly: true}),
    defineField({name: 'publicationDate', type: 'string', description: 'Provider date, preserving year-only or year-month precision.'}),
    defineField({
      name: 'cover', type: 'object', fields: [
        defineField({name: 'url', type: 'url', validation: (rule) => rule.uri({scheme: ['https']})}),
        defineField({name: 'source', type: 'string', options: {list: ['google', 'openLibrary', 'manual']}}),
      ],
    }),
    defineField({name: 'needsCover', type: 'boolean', initialValue: true, description: 'No provider cover was verified. Add a manual override for this edition.'}),
    defineField({
      name: 'title',
      type: 'string',
      description: 'Edition-specific title if it differs from the book.',
    }),
    defineField({
      name: 'book',
      type: 'reference',
      to: [{type: 'book'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'isbn13',
      type: 'string',
    }),
    defineField({
      name: 'isbn10',
      type: 'string',
    }),
    defineField({
      name: 'openLibraryEditionKey',
      type: 'string',
      description: 'Open Library edition key, e.g. OL7353617M',
    }),
    defineField({
      name: 'format',
      type: 'string',
      options: {
        list: [
          {title: 'Hardcover', value: 'hardcover'},
          {title: 'Paperback', value: 'paperback'},
          {title: 'Ebook', value: 'ebook'},
          {title: 'Audiobook', value: 'audiobook'},
          {title: 'Other', value: 'other'},
        ],
      },
    }),
    defineField({
      name: 'market',
      type: 'string',
      description: 'Release market, e.g. US, UK, or World English.',
    }),
    defineField({
      name: 'publisher',
      type: 'string',
    }),
    defineField({
      name: 'onSaleDate',
      type: 'date',
      description: 'Date this edition went on sale. Reprints keep their own on-sale date.',
    }),
    defineField({
      name: 'isReprint',
      type: 'boolean',
      initialValue: false,
      description: 'True when this edition is a reprint or reissue, not a first publication of the book.',
    }),
    defineField({
      name: 'firstPublicationOfBook',
      type: 'boolean',
      initialValue: false,
      description: 'True only when this edition is the first publication of the book.',
    }),
    defineField({
      name: 'coverOpenLibraryId',
      type: 'string',
      description: 'Open Library cover or edition ID used with covers.openlibrary.org. Do not re-host OL covers.',
    }),
    defineField({
      name: 'coverUrl',
      type: 'url',
      description: 'Legacy provider cover URL. New imports use cover.url and cover.source.',
      validation: (rule) => rule.uri({scheme: ['https']}),
    }),
    defineField({
      name: 'coverOverride',
      type: 'image',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          type: 'string',
          title: 'Alternative text',
        }),
      ],
      description: 'Use only when we have rights to host the image in Sanity.',
    }),
    defineField({
      name: 'provenance',
      type: 'sourceProvenance',
    }),
    defineField({
      name: 'editorialLocked',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      bookTitle: 'book.title',
      isbn: 'isbn13',
      reprint: 'isReprint',
    },
    prepare({title, bookTitle, isbn, reprint}) {
      return {
        title: title || bookTitle || 'Untitled edition',
        subtitle: [isbn, reprint ? 'Reprint' : 'Original-or-unknown'].filter(Boolean).join(' · '),
      }
    },
  },
})
