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
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required().min(1).max(120),
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
      description: 'Set to Hidden to take this off the site without deleting it. Delete the document to remove it entirely.',
      options: {
        list: [
          {title: 'Visible', value: 'visible'},
          {title: 'Hidden', value: 'hidden'},
        ],
        layout: 'radio',
      },
    }),
  ],
  preview: {
    select: {
      title: 'title',
      body: 'body',
      book: 'book.title',
      reader: 'reader.displayName',
      visibility: 'visibility',
      moderationStatus: 'moderationStatus',
    },
    prepare({title, body, book, reader, visibility, moderationStatus}) {
      const heading = typeof title === 'string' ? title.trim() : ''
      const snippet = typeof body === 'string' ? body.trim().slice(0, 80) : ''
      const state = moderationStatus === 'hidden' ? 'Hidden' : visibility === 'public' ? 'Public' : 'Private'
      return {
        title: heading || snippet || 'Review',
        subtitle: [book, reader, state].filter(Boolean).join(' · '),
      }
    },
  },
})
