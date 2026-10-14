import {defineField, defineType} from 'sanity'
import {selectedEdition} from '../fields/selectedEdition'
import {DocumentIcon} from '@sanity/icons'

const partialDatePattern = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/

function partialDateStart(value: string) {
  return value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value
}

function partialDateEnd(value: string) {
  if (value.length === 4) return `${value}-12-31`
  if (value.length === 7) {
    return new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).toISOString().slice(0, 10)
  }
  return value
}

function validPartialDate(value?: string) {
  if (!value) return true
  const complete = partialDateStart(value)
  const date = new Date(`${complete}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== complete) return 'Choose a valid date'
  return value <= new Date().toISOString().slice(0, value.length) || 'Date cannot be in the future'
}

export const readingProgress = defineType({
  name: 'readingProgress',
  title: 'Reading progress',
  type: 'document',
  icon: DocumentIcon,
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
    selectedEdition,
    defineField({
      name: 'readingPeriod',
      title: 'Reading period',
      type: 'object',
      description: 'When this book was read. Dates may be a year, month, or exact day.',
      fields: [
        defineField({
          name: 'start',
          title: 'Started',
          type: 'string',
          description: 'Optional. Use YYYY, YYYY-MM, or YYYY-MM-DD.',
          validation: (rule) => rule
            .regex(partialDatePattern, {name: 'partial date', invert: false})
            .custom(validPartialDate),
        }),
        defineField({
          name: 'end',
          title: 'Finished',
          type: 'string',
          description: 'Use YYYY, YYYY-MM, or YYYY-MM-DD.',
          validation: (rule) => rule
            .required()
            .regex(partialDatePattern, {name: 'partial date', invert: false})
            .custom(validPartialDate),
        }),
      ],
      validation: (rule) => rule.custom((period) => {
        if (!period || typeof period !== 'object') return true
        const {start, end} = period as {start?: string; end?: string}
        if (!start || !end) return true
        return partialDateStart(start) <= partialDateEnd(end) || 'Started must be before Finished'
      }),
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: {
        list: [
          {title: 'Want to Read', value: 'wantToRead'},
          {title: 'Currently Reading', value: 'currentlyReading'},
          {title: 'Read', value: 'finished'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'percent',
      type: 'number',
      validation: (rule) => rule.min(0).max(100),
    }),
    defineField({name: 'startedAt', type: 'date'}),
    defineField({name: 'finishedAt', type: 'date'}),
    defineField({name: 'readCount', type: 'number', validation: (rule) => rule.integer().min(0)}),
    defineField({name: 'importSource', type: 'string', readOnly: true}),
  ],
})
