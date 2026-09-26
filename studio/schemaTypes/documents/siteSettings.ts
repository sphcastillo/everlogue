import {defineField, defineType} from 'sanity'
import {CogIcon} from '@sanity/icons'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'tagline',
      type: 'string',
      initialValue: 'A home for everything you read',
    }),
    defineField({
      name: 'catalogDisclaimer',
      type: 'text',
      rows: 4,
      initialValue:
        'Read Evermore keeps a small, verified catalog. New-release pages show books we have actually imported. This is not a complete record of every book published.',
    }),
    defineField({
      name: 'ratingMethod',
      type: 'text',
      rows: 5,
      initialValue:
        'Fantasy by Year ranks books whose first publication year matches the selected year. The score is the average of current Read Evermore half-star ratings (0.5–5). A book appears in the ranked list only when it has at least 3 ratings. We do not import or invent Goodreads or other community scores. If too few ratings exist, you may see an empty state or a separately labeled editorial collection.',
    }),
    defineField({
      name: 'minimumRatingCount',
      type: 'number',
      initialValue: 3,
      validation: (rule) => rule.min(1).integer(),
    }),
    defineField({
      name: 'openLibraryAttribution',
      type: 'string',
      initialValue: 'Book metadata and cover images from Open Library, used with attribution.',
    }),
  ],
})
