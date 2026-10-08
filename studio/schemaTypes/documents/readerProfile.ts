import {defineField, defineType} from 'sanity'
import {UsersIcon} from '@sanity/icons'

export const readerProfile = defineType({
  name: 'readerProfile',
  title: 'Reader profile',
  type: 'document',
  icon: UsersIcon,
  fields: [
    defineField({
      name: 'clerkUserId',
      type: 'string',
      validation: (rule) => rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'displayName',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      readOnly: true,
      description: 'Primary email on the attached Clerk account.',
    }),
    defineField({
      name: 'avatar',
      title: 'Profile image',
      type: 'image',
      options: {hotspot: true},
      description: 'Shown in the header. Avatar URL is used when this is empty.',
      fields: [defineField({name: 'alt', title: 'Alternative text', type: 'string'})],
    }),
    defineField({
      name: 'avatarUrl',
      title: 'Avatar URL',
      type: 'url',
      readOnly: true,
      description: 'Synced from Clerk. Used in the header when no profile image is uploaded.',
    }),
    defineField({
      name: 'bio',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'profileVisibility',
      type: 'string',
      initialValue: 'private',
      options: {
        list: [
          {title: 'Private', value: 'private'},
          {title: 'Public display name only', value: 'publicName'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'spaceColor',
      title: 'Space color',
      type: 'string',
      initialValue: 'sky',
      options: {
        list: [
          {title: 'Cloud', value: 'cloud'},
          {title: 'Blush', value: 'blush'},
          {title: 'Violet', value: 'violet'},
          {title: 'Clay', value: 'clay'},
          {title: 'Apricot', value: 'apricot'},
          {title: 'Butter', value: 'butter'},
          {title: 'Mint', value: 'mint'},
          {title: 'Sky', value: 'sky'},
          {title: 'Navy', value: 'navy'},
        ],
        layout: 'radio',
      },
    }),
  ],
  preview: {
    select: {title: 'displayName', email: 'email', clerkUserId: 'clerkUserId', media: 'avatar'},
    prepare({title, email, clerkUserId, media}) {
      return {title, subtitle: email || clerkUserId, media}
    },
  },
})
