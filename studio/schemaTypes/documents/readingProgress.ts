import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons'

export const readingProgress = defineType({
  name: 'readingProgress',
  title: 'Reading progress',
  type: 'document',
  icon: DocumentIcon,
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
      name: 'edition',
      type: 'reference',
      to: [{type: 'edition'}],
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: {
        list: [
          {title: 'Want to Read', value: 'wantToRead'},
          {title: 'Currently Reading', value: 'currentlyReading'},
          {title: 'Read', value: 'finished'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'percent',
      type: 'number',
      validation: (rule) => rule.min(0).max(100),
    }),
    defineField({name: 'startedAt', type: 'date'}),
    defineField({name: 'finishedAt', type: 'date'}),
    defineField({name: 'readCount', type: 'number', validation: (rule) => rule.integer().min(0)}),
    defineField({name: 'importSource', type: 'string', readOnly: true}),
  ],
})
