import {defineArrayMember, defineField, defineType} from 'sanity'
import {SearchIcon} from '@sanity/icons'
import {CLUBS} from '../../../src/lib/book-club-watch/model'

const metadataFields = [
  defineField({name: 'title', type: 'string'}),
  defineField({name: 'authors', type: 'array', of: [defineArrayMember({type: 'string'})]}),
  defineField({name: 'description', type: 'text'}),
  defineField({name: 'coverUrl', type: 'url', validation: (r) => r.uri({scheme: ['https']})}),
  ...['isbn13', 'isbn10', 'googleBooksId', 'publisher', 'publishedDate', 'language'].map((name) => defineField({name, type: 'string'})),
  defineField({name: 'pageCount', type: 'number', validation: (r) => r.integer().positive()}),
]
export const bookClubDiscovery = defineType({
  name: 'bookClubDiscovery', title: 'Book Club Discovery', type: 'document', icon: SearchIcon,
  readOnly: true,
  fields: [
    defineField({name: 'catalogBaselineRevision', type: 'string', hidden: true, readOnly: true}),
    defineField({name: 'catalogBook', title: 'Bookclub import', type: 'reference', to: [{type: 'book'}], weak: true, readOnly: true}),
    defineField({name: 'bookClub', type: 'string', readOnly: true, options: {list: Object.entries(CLUBS).map(([value, c]) => ({value, title: c.name}))}}),
    defineField({name: 'status', type: 'string', readOnly: true, options: {list: ['discovered', 'needs_review', 'approved', 'published', 'rejected']}}),
    defineField({name: 'selectionMonth', type: 'string', validation: (r) => r.required().regex(/^\d{4}-(0[1-9]|1[0-2])$/), description: 'Official selection month, YYYY-MM.'}),
    defineField({name: 'selectionDate', type: 'string', description: 'Optional official date, YYYY-MM or YYYY-MM-DD.'}),
    ...['discoveredTitle', 'discoveredAuthor', 'sourceName', 'identity'].map((name) => defineField({name, type: 'string', readOnly: true})),
    defineField({name: 'discoveredAuthors', type: 'array', readOnly: true, of: [defineArrayMember({type: 'string'})]}),
    defineField({name: 'sourceUrl', type: 'url', readOnly: true}),
    defineField({name: 'sourceEvidence', type: 'text', readOnly: true}),
    defineField({name: 'discoveredAt', type: 'datetime', readOnly: true}),
    defineField({name: 'isbn13', type: 'string', readOnly: true}),
    defineField({name: 'reviewedTitle', type: 'string', description: 'Leave empty to use the discovered title.'}),
    defineField({name: 'reviewedAuthors', type: 'array', of: [defineArrayMember({type: 'string'})], description: 'Leave unset to use discovered authors.'}),
    defineField({name: 'matchedBook', type: 'reference', to: [{type: 'book'}], options: {disableNew: true}}),
    defineField({name: 'matchConfidence', type: 'number', readOnly: true, description: 'Rule-based matching score (0–1), not a probability.'}),
    defineField({name: 'matchExplanation', type: 'text', readOnly: true}),
    defineField({name: 'proposedMetadata', type: 'object', fields: metadataFields, description: 'Verify this proposed edition metadata before creating a new book.'}),
    defineField({name: 'publicationMode', type: 'string', options: {list: [{title: 'Link the selected existing book', value: 'existing'}, {title: 'Create a new book from reviewed metadata', value: 'new'}], layout: 'radio'}}),
    defineField({name: 'approval', type: 'object', readOnly: true, fields: [
      defineField({name: 'title', type: 'string'}),
      defineField({name: 'authors', type: 'array', of: [defineArrayMember({type: 'string'})]}),
      ...['selectionMonth', 'selectionDate', 'mode'].map((name) => defineField({name, type: 'string'})),
      defineField({name: 'matchedBook', type: 'reference', to: [{type: 'book'}]}),
      defineField({name: 'metadata', type: 'object', fields: metadataFields}),
    ]}),
    ...['approvedAt', 'publishedAt', 'retryRequestedAt'].map((name) => defineField({name, type: 'datetime', readOnly: true})),
    defineField({name: 'reviewedBy', type: 'string', readOnly: true}),
    defineField({name: 'publishedBook', type: 'reference', to: [{type: 'book'}], readOnly: true}),
    ...['processingError', 'enrichmentError'].map((name) => defineField({name, type: 'text', readOnly: true})),
  ],
  preview: {select: {title: 'discoveredTitle', club: 'bookClub', month: 'selectionMonth', status: 'status'}, prepare({title, club, month, status}) { return {title, subtitle: `${club} · ${month} · ${status}`} }},
})
