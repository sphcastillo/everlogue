import {defineArrayMember, defineField, defineType} from 'sanity'
import {ClockIcon} from '@sanity/icons'
export const bookClubWatchRun = defineType({
  name: 'bookClubWatchRun', title: 'Book Club Watch Run', type: 'document', icon: ClockIcon, readOnly: true,
  fields: [
    ...['bookClub', 'invocationId', 'outcome'].map((name) => defineField({name, type: 'string'})),
    ...['startedAt', 'finishedAt'].map((name) => defineField({name, type: 'datetime'})),
    defineField({name: 'reason', type: 'text'}),
    defineField({name: 'sourceUrl', type: 'url'}),
    defineField({name: 'discoveries', type: 'array', of: [defineArrayMember({type: 'reference', to: [{type: 'bookClubDiscovery'}]})]}),
  ],
  preview: {select: {club: 'bookClub', outcome: 'outcome', startedAt: 'startedAt'}, prepare({club, outcome, startedAt}) { return {title: `${club} · ${outcome}`, subtitle: startedAt} }},
})
