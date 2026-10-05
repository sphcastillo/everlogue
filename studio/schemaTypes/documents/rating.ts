import {defineField, defineType} from 'sanity'
import {StarIcon} from '@sanity/icons'

export const rating = defineType({
  name: 'rating',
  title: 'Rating',
  type: 'document',
  icon: StarIcon,
  fields: [
    defineField({
      name: 'reader',
      type: 'reference',
      to: [{type: 'readerProfile'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'book',
      type: 'reference',
      to: [{type: 'book'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'value',
      type: 'number',
      description: '0.5 to 5 in half-star steps. Unrated is the absence of this document, not zero.',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (typeof value !== 'number') return 'Required'
          if (value < 0.5 || value > 5) return 'Must be between 0.5 and 5'
          if (Math.round(value * 2) !== value * 2) return 'Must be a half-star increment'
          return true
        }),
    }),
  ],
  preview: {
    select: {value: 'value', book: 'book.title', reader: 'reader.displayName'},
    prepare({value, book, reader}) {
      return {title: `${value ?? '—'} ★ · ${book || 'Untitled book'}`, subtitle: reader || 'Reader'}
    },
  },
})
