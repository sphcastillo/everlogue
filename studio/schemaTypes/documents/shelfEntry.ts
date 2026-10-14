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
      title: 'Added to shelf at',
      type: 'datetime',
      description: 'Shelf membership timestamp. Goodreads Date Added is also copied to reading progress as the start date.',
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
