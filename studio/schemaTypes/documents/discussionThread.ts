import {defineField, defineType} from 'sanity'
import {DocumentTextIcon} from '@sanity/icons'

export const discussionThread = defineType({
  name: 'discussionThread',
  title: 'Discussion thread',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'club',
      type: 'reference',
      to: [{type: 'communityClub'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'book',
      type: 'reference',
      to: [{type: 'book'}],
    }),
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'spoilerBoundary',
      type: 'string',
      initialValue: 'unmarked',
      options: {
        list: [
          {title: 'No spoilers expected', value: 'none'},
          {title: 'Mark spoilers', value: 'unmarked'},
          {title: 'Full spoilers', value: 'full'},
        ],
      },
    }),
    defineField({
      name: 'isDemoThread',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})
