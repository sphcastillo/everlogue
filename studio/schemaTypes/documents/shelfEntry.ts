import {defineField, defineType} from 'sanity'
import {selectedEdition} from '../fields/selectedEdition'
import {DocumentIcon} from '@sanity/icons'

export const shelfEntry = defineType({
  name: 'shelfEntry',
  title: 'Shelf entry',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    selectedEdition,
    defineField({
      name: 'shelf',
      type: 'reference',
      to: [{type: 'shelf'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'book',
      type: 'reference',
      to: [{type: 'book'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'addedAt',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {book: 'book.title', shelf: 'shelf.name'},
    prepare({book, shelf}) {
      return {title: book, subtitle: shelf}
    },
  },
})
