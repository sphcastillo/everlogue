import {defineField, defineType} from 'sanity'
import {CheckmarkCircleIcon} from '@sanity/icons'

export const editorialReview = defineType({
  name: 'editorialReview',
  title: 'Editorial review',
  type: 'document',
  icon: CheckmarkCircleIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'target',
      type: 'reference',
      to: [
        {type: 'celebritySelection'},
        {type: 'editorialCollection'},
        {type: 'edition'},
        {type: 'book'},
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      type: 'string',
      initialValue: 'proposed',
      options: {
        list: [
          {title: 'Proposed', value: 'proposed'},
          {title: 'Needs review', value: 'needsReview'},
          {title: 'Approved', value: 'approved'},
          {title: 'Rejected', value: 'rejected'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'proposedBy', type: 'string'}),
    defineField({name: 'reviewedBy', type: 'string'}),
    defineField({name: 'reviewedAt', type: 'datetime'}),
    defineField({name: 'note', type: 'text', rows: 4}),
  ],
  preview: {
    select: {title: 'title', status: 'status'},
    prepare({title, status}) {
      return {title, subtitle: status}
    },
  },
})
