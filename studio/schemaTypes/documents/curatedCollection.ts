import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon, StarIcon} from '@sanity/icons'

// These fields match the existing records written by the book-club importers.
export const curatedCollection = defineType({
  name: 'curatedCollection',
  title: 'Book club collection',
  type: 'document',
  icon: StarIcon,
  fields: [
    defineField({name: 'title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'slug', type: 'slug', options: {source: 'title'}, validation: (rule) => rule.required()}),
    defineField({
      name: 'image',
      title: 'Club image',
      type: 'image',
      options: {hotspot: true},
      description: 'Shown next to the club name on Discover and the club page. Initials are used when this is empty.',
      fields: [defineField({name: 'alt', title: 'Alternative text', type: 'string'})],
    }),
    defineField({name: 'description', type: 'text', rows: 3}),
    defineField({
      name: 'curator', type: 'object',
      fields: [defineField({name: 'name', type: 'string'})],
    }),
    defineField({
      name: 'instagramUrl',
      title: 'Instagram',
      type: 'url',
      description: 'Follow on the site opens this Instagram profile.',
      validation: (rule) =>
        rule.uri({scheme: ['http', 'https']}).custom((value) => {
          if (!value) return true
          try {
            const host = new URL(value).hostname.replace(/^www\./, '')
            return host === 'instagram.com' || 'Use an instagram.com URL.'
          } catch {
            return 'Use a full Instagram URL, such as https://www.instagram.com/username'
          }
        }),
    }),
    defineField({
      name: 'books', title: 'Book selections', type: 'array',
      of: [defineArrayMember({
        name: 'curatedCollectionEntry', title: 'Book selection', type: 'object', icon: BookIcon,
        fields: [
          defineField({name: 'book', type: 'reference', to: [{type: 'book'}], validation: (rule) => rule.required()}),
          defineField({
            name: 'selectionNumber', type: 'number',
            description: 'Higher numbers are later picks. The site shows the latest pick first and the first book last.',
            validation: (rule) => rule.required().integer().min(1),
          }),
          defineField({name: 'month', type: 'string', description: 'Selection month, e.g. September.'}),
          defineField({name: 'year', type: 'number', validation: (rule) => rule.integer()}),
          defineField({
            name: 'selectionDate', type: 'string',
            description: 'Imported selection date; preserves year-month or full-date precision.',
          }),
        ],
        preview: {
          select: {title: 'book.title', number: 'selectionNumber', month: 'month', year: 'year', date: 'selectionDate', media: 'book.coverOverride'},
          prepare({title, number, month, year, date, media}) {
            return {
              title: title || 'Choose a book',
              subtitle: [number ? `#${number}` : null, date || [month, year].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
              media,
            }
          },
        },
      })],
    }),
    defineField({
      name: 'source', type: 'object',
      fields: [defineField({name: 'name', type: 'string'}), defineField({name: 'url', type: 'url'})],
    }),
    defineField({name: 'collectionType', type: 'string', initialValue: 'celebrityBookClub', readOnly: true}),
    defineField({
      name: 'sortOrder',
      title: 'Display order',
      type: 'number',
      description: 'Lower numbers appear first on Discover. Image and text updates do not change this.',
      validation: (rule) => rule.integer().min(1),
    }),
    defineField({name: 'totalSelections', type: 'number', readOnly: true, description: 'Total selections reported by the last import.'}),
    defineField({name: 'lastSyncedAt', type: 'datetime', readOnly: true}),
  ],
  preview: {select: {title: 'title', subtitle: 'curator.name', media: 'image'}},
})
