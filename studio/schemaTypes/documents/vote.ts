import {defineField, defineType} from 'sanity'
import {CheckmarkCircleIcon} from '@sanity/icons'

export const vote = defineType({
  name: 'vote',
  title: 'Vote',
  type: 'document',
  icon: CheckmarkCircleIcon,
  fields: [
    defineField({
      name: 'poll',
      type: 'reference',
      to: [{type: 'poll'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'reader',
      type: 'reference',
      to: [{type: 'readerProfile'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'option',
      type: 'reference',
      to: [{type: 'book'}],
      validation: (rule) => rule.required(),
    }),
  ],
})
