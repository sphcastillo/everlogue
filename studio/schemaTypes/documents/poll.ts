import {defineArrayMember, defineField, defineType} from 'sanity'
import {HelpCircleIcon} from '@sanity/icons'

export const poll = defineType({
  name: 'poll',
  title: 'Club poll',
  type: 'document',
  icon: HelpCircleIcon,
  fields: [
    defineField({
      name: 'club',
      type: 'reference',
      to: [{type: 'communityClub'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      type: 'string',
      initialValue: 'open',
      options: {
        list: [
          {title: 'Open', value: 'open'},
          {title: 'Closed', value: 'closed'},
        ],
      },
    }),
    defineField({
      name: 'options',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'book'}]})],
      validation: (rule) => rule.min(2).unique(),
    }),
    defineField({name: 'closesAt', type: 'datetime'}),
    defineField({
      name: 'allowVoteChange',
      type: 'boolean',
      initialValue: true,
    }),
  ],
})
