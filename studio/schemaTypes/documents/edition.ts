import {defineArrayMember, defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons'
import {isbn10For, normalizeIsbn} from '../../../src/lib/isbn'

export const edition = defineType({
  name: 'edition',
  title: 'Edition',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({name: 'importKey', type: 'string', hidden: true, readOnly: true}),
    defineField({name: 'googleBooksId', type: 'string', readOnly: true}),
    defineField({name: 'metadataCheckedAt', type: 'datetime', readOnly: true}),
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
      title: 'ISBN-13',
      type: 'string',
      description: 'One edition per ISBN. An unchanged reprint keeps the same ISBN.',
      validation: (rule) => rule.custom(async (value, context) => {
        if (!value) return true
        if (!/^\d{13}$/.test(value) || normalizeIsbn(value) !== value) return 'Enter a valid ISBN-13 without spaces or hyphens'
        const id = String(context.document?._id || '').replace(/^drafts\./, '')
        const count = await context.getClient({apiVersion: '2026-02-01'}).fetch<number>(
          `count(*[_type == "edition" && (isbn13 == $isbn || ($isbn10 != "" && isbn10 == $isbn10)) && !(_id in [$id, $draftId])])`,
          {isbn: value, isbn10: isbn10For(value) || '', id, draftId: `drafts.${id}`},
        )
        return count === 0 || 'This ISBN already belongs to an edition. Use the existing edition.'
      }),
    }),
    defineField({
      name: 'isbn10',
      type: 'string',
      validation: (rule) => rule.custom(async (value, context) => {
        if (!value) return true
        const canonical = normalizeIsbn(value)
        if (!/^\d{9}[\dX]$/.test(value) || !canonical) return 'Enter a valid ISBN-10'
        if (context.document?.isbn13 && canonical !== context.document.isbn13) return 'ISBN-10 and ISBN-13 must identify the same edition'
        const id = String(context.document?._id || '').replace(/^drafts\./, '')
        const count = await context.getClient({apiVersion: '2026-02-01'}).fetch<number>(
          `count(*[_type == "edition" && (isbn10 == $isbn10 || isbn13 == $isbn13) && !(_id in [$id, $draftId])])`,
          {isbn10: value, isbn13: canonical, id, draftId: `drafts.${id}`},
        )
        return count === 0 || 'This ISBN already belongs to an edition. Use the existing edition.'
      }),
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
    defineField({name: 'pageCount', type: 'number', validation: (rule) => rule.integer().positive()}),
    defineField({name: 'language', type: 'string', description: 'Language of this edition, e.g. en, fr, or eng.'}),
    defineField({name: 'translators', type: 'array', of: [defineArrayMember({type: 'string'})], description: 'Translator credits, kept separately from the book’s authors.'}),
    defineField({name: 'editionStatement', type: 'string', description: 'For example: Second edition, Revised and expanded, or Anniversary edition.'}),
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
      description: 'Date this edition went on sale. Unchanged reprints with the same ISBN share this edition.',
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
    defineField({
      name: 'providerTitleMismatch',
      title: 'Title/author mismatch',
      type: 'boolean',
      readOnly: true,
      description: 'The Google or Open Library title or author for this ISBN does not match the linked book.',
    }),
    defineField({
      name: 'providerTitle',
      title: 'Provider title',
      type: 'string',
      readOnly: true,
      hidden: ({document}) => !document?.providerTitleMismatch,
    }),
    defineField({
      name: 'providerAuthors',
      title: 'Provider authors',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      readOnly: true,
      hidden: ({document}) => !document?.providerTitleMismatch,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      bookTitle: 'book.title',
      isbn: 'isbn13',
      publisher: 'publisher',
      format: 'format',
      language: 'language',
      date: 'publicationDate',
      mismatch: 'providerTitleMismatch',
    },
    prepare({title, bookTitle, isbn, publisher, format, language, date, mismatch}) {
      return {
        title: title || bookTitle || 'Untitled edition',
        subtitle: [mismatch ? 'Title/author mismatch' : null, format, publisher, date, language, isbn].filter(Boolean).join(' · '),
      }
    },
  },
})
