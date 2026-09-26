import {defineArrayMember, defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons'

export const editorialCollection = defineType({
  name: 'editorialCollection',
  title: 'Editorial collection',
  type: 'document',
  icon: DocumentIcon,
  fields: [
    defineField({name: 'featuredEditions', title: 'Featured editions', type: 'array', of: [defineArrayMember({type: 'reference', to: [{type: 'edition'}]})], description: 'Choose the specific editions featured in this collection. Their covers take priority over the default book cover.'}),
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
      name: 'description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'kind',
      type: 'string',
      options: {
        list: [
          {title: 'Discover row', value: 'discover'},
          {title: 'Fantasy by year fallback', value: 'fantasyByYear'},
          {title: 'Other', value: 'other'},
        ],
      },
      initialValue: 'discover',
    }),
    defineField({
      name: 'workflowStatus',
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
    defineField({
      name: 'books',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'book'}]})],
    }),
    defineField({
      name: 'year',
      type: 'number',
      hidden: ({parent}) => parent?.kind !== 'fantasyByYear',
    }),
    defineField({
      name: 'editorialLabel',
      type: 'string',
      description: 'Shown when this collection is an editorial fallback rather than a community ranking.',
    }),
  ],
  preview: {
    select: {title: 'title', status: 'workflowStatus'},
    prepare({title, status}) {
      return {title, subtitle: status}
    },
  },
})
