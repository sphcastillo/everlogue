import {defineArrayMember, defineField, defineType} from 'sanity'
import {CommentIcon} from '@sanity/icons'

export const companionConversation = defineType({
  name: 'companionConversation',
  title: 'Reading companion conversation',
  type: 'document',
  icon: CommentIcon,
  fields: [
    defineField({
      name: 'reader',
      type: 'reference',
      to: [{type: 'readerProfile'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'messages',
      type: 'array',
      validation: (rule) => rule.max(40),
      of: [
        defineArrayMember({
          name: 'companionMessage',
          type: 'object',
          fields: [
            defineField({
              name: 'role',
              type: 'string',
              options: {list: ['user', 'assistant']},
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'text',
              type: 'text',
              rows: 4,
              validation: (rule) => rule.required().max(8000),
            }),
            defineField({
              name: 'createdAt',
              type: 'datetime',
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'hiddenRecommendationIds',
      type: 'array',
      hidden: true,
      of: [defineArrayMember({type: 'string'})],
    }),
    defineField({name: 'updatedAt', type: 'datetime', readOnly: true}),
  ],
  preview: {
    select: {reader: 'reader.displayName', updatedAt: 'updatedAt'},
    prepare({reader, updatedAt}) {
      return {
        title: reader || 'Reader conversation',
        subtitle: updatedAt ? `Updated ${updatedAt}` : 'No messages',
      }
    },
  },
})
