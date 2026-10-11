import {defineField, defineType} from 'sanity'
import {UserIcon} from '@sanity/icons'
import {authorSlug} from '../../../src/lib/author-slug'

export const author = defineType({
  name: 'author',
  title: 'Author',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {
        source: 'name',
        slugify: (value: string) => authorSlug(value),
      },
      validation: (rule) =>
        rule.required().custom(async (value, context) => {
          const current = value?.current
          if (!current) return true
          const id = String(context.document?._id || '').replace(/^drafts\./, '')
          const count = await context.getClient({apiVersion: '2026-02-01'}).fetch<number>(
            `count(*[_type == "author" && slug.current == $slug && !(_id in [$id, $draftId])])`,
            {slug: current, id, draftId: `drafts.${id}`},
          )
          return count === 0 || 'This slug is already used by another author.'
        }),
    }),
    defineField({
      name: 'bio',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'openLibraryAuthorKey',
      type: 'string',
    }),
    defineField({
      name: 'provenance',
      type: 'sourceProvenance',
    }),
    defineField({
      name: 'editorialLocked',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: {title: 'name', subtitle: 'openLibraryAuthorKey'},
  },
})
