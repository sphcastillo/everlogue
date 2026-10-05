import {defineField, defineType} from 'sanity'
import {StackCompactIcon} from '@sanity/icons'
import {SeriesBooksInput} from '../../components/SeriesBooksInput'

export const bookSeries = defineType({
  name: 'bookSeries',
  title: 'Series',
  type: 'document',
  icon: StackCompactIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'title'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'booksInSeries',
      title: 'Books in this series',
      type: 'string',
      readOnly: true,
      components: {input: SeriesBooksInput},
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Untitled series', subtitle: 'Series'}
    },
  },
})
