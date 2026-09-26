import {defineField, defineType} from 'sanity'
import {UsersIcon} from '@sanity/icons'

export const communityClub = defineType({
  name: 'communityClub',
  title: 'Community club',
  type: 'document',
  icon: UsersIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'name'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'visibility',
      type: 'string',
      initialValue: 'public',
      options: {
        list: [
          {title: 'Public', value: 'public'},
          {title: 'Private', value: 'private'},
        ],
      },
    }),
    defineField({
      name: 'owner',
      type: 'reference',
      to: [{type: 'readerProfile'}],
    }),
    defineField({
      name: 'currentRead',
      type: 'reference',
      to: [{type: 'book'}],
    }),
    defineField({
      name: 'isDemoClub',
      type: 'boolean',
      initialValue: false,
      description: 'Demo activity must stay labeled and separate from genuine reader activity.',
    }),
  ],
})
