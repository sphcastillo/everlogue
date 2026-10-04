import {defineField, defineType} from 'sanity'
import {ErrorOutlineIcon} from '@sanity/icons'

export const catalogImportFailure = defineType({
  name: 'catalogImportFailure',
  title: 'Failed to Upload Import',
  type: 'document',
  icon: ErrorOutlineIcon,
  readOnly: true,
  description: 'A Goodreads import that did not land on the reader’s shelf. Catalog book is filled when this is a title we already have — use that book instead of creating another.',
  fields: [
    defineField({
      name: 'reader',
      title: 'Reader',
      type: 'reference',
      to: [{type: 'readerProfile'}],
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'readerName', title: 'Reader name', type: 'string'}),
    defineField({
      name: 'book',
      title: 'Catalog book',
      type: 'reference',
      to: [{type: 'book'}],
      description: 'Filled when this request is a book already in the Everlogue catalog. That existing book replaces the incoming request.',
    }),
    defineField({name: 'title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'author', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'isbn10', title: 'ISBN-10', type: 'string'}),
    defineField({name: 'isbn13', title: 'ISBN-13', type: 'string'}),
    defineField({name: 'goodreadsId', title: 'Goodreads book ID', type: 'string'}),
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
    defineField({name: 'publicationYear', type: 'number'}),
    defineField({name: 'csvRow', title: 'CSV row', type: 'number'}),
    defineField({name: 'message', title: 'Failure', type: 'text', rows: 3}),
    defineField({name: 'importKey', type: 'string'}),
    defineField({name: 'retryCount', type: 'number'}),
    defineField({name: 'failedAt', type: 'datetime'}),
    defineField({name: 'lastFailedAt', type: 'datetime'}),
    defineField({name: 'resolvedAt', type: 'datetime'}),
  ],
  orderings: [{title: 'Newest first', name: 'newest', by: [{field: 'lastFailedAt', direction: 'desc'}]}],
  preview: {
    select: {
      title: 'title',
      author: 'author',
      readerName: 'readerName',
      rating: 'rating',
      shelfStatus: 'shelfStatus',
      catalogTitle: 'book.title',
    },
    prepare({title, author, readerName, rating, shelfStatus, catalogTitle}) {
      const shelf =
        shelfStatus === 'finished' ? 'Read' : shelfStatus === 'currentlyReading' ? 'Currently reading' : shelfStatus === 'wantToRead' ? 'Want to read' : 'Shelf unknown'
      const match = catalogTitle ? `Already in catalog: ${catalogTitle}` : 'New book request'
      return {
        title: title || 'Untitled import',
        subtitle: [match, author, readerName, rating ? `${rating}★` : 'Unrated', shelf].filter(Boolean).join(' · '),
      }
    },
  },
})
