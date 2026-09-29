import {defineField, defineType} from 'sanity'
import {StarIcon} from '@sanity/icons'

export const celebrityClub = defineType({
  name: 'celebrityClub',
  title: 'Celebrity book club',
  type: 'document',
  icon: StarIcon,
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
      name: 'officialUrl',
      type: 'url',
      validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'disclaimer',
      type: 'text',
      rows: 2,
      initialValue:
        'Everlogue is not affiliated with this book club. Selections are listed only when verified from an official source.',
    }),
  ],
})
