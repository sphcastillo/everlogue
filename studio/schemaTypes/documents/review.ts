import {defineField, defineType} from 'sanity'
import {DocumentTextIcon} from '@sanity/icons'

export const review = defineType({
  name: 'review',
  title: 'Review',
  type: 'document',
  icon: DocumentTextIcon,
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
      name: 'body',
      type: 'text',
      validation: (rule) => rule.required().min(1).max(8000),
    }),
    defineField({
      name: 'hasSpoilers',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'visibility',
      type: 'string',
      initialValue: 'private',
      options: {
        list: [
          {title: 'Private', value: 'private'},
          {title: 'Public', value: 'public'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'moderationStatus',
      type: 'string',
      initialValue: 'visible',
      options: {
        list: [
          {title: 'Visible', value: 'visible'},
          {title: 'Hidden', value: 'hidden'},
        ],
      },
    }),
  ],
})
