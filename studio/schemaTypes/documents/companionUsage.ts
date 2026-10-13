import {defineArrayMember, defineField, defineType} from 'sanity'

const tokenFields = () => ['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningTokens', 'estimatedUsd']
  .map(name => defineField({name, type: 'number'}))

export const companionUsage = defineType({
  name: 'companionUsage', title: 'Companion usage', type: 'document', readOnly: true,
  description: 'One admitted question. Costs are estimates from reported model usage, not invoices. No conversation content is stored here.',
  fields: [
    defineField({name: 'model', type: 'string'}),
    defineField({name: 'audience', type: 'string'}),
    defineField({
      name: 'reader',
      title: 'Account',
      type: 'reference',
      to: [{type: 'readerProfile'}],
      readOnly: true,
      description: 'Signed-in reader who asked. Empty for guests.',
    }),
    defineField({name: 'status', type: 'string'}),
    defineField({name: 'startedAt', type: 'datetime'}),
    defineField({name: 'finishedAt', type: 'datetime'}),
    defineField({name: 'durationMs', type: 'number'}),
    defineField({name: 'modelCalls', type: 'number'}),
    defineField({name: 'usageIncomplete', type: 'boolean', description: 'Interrupted or failed requests may have billed usage that the provider did not report.'}),
    ...tokenFields(),
    defineField({name: 'stages', type: 'array', of: [defineArrayMember({
      type: 'object', fields: [defineField({name: 'stage', type: 'string'}), ...tokenFields(), defineField({name: 'usageMissing', type: 'boolean'})],
      preview: {select: {title: 'stage', subtitle: 'estimatedUsd'}},
    })]}),
  ],
  orderings: [{title: 'Newest first', name: 'newest', by: [{field: 'startedAt', direction: 'desc'}]}],
  preview: {
    select: {
      status: 'status',
      startedAt: 'startedAt',
      estimatedUsd: 'estimatedUsd',
      modelCalls: 'modelCalls',
      audience: 'audience',
      email: 'reader.email',
      name: 'reader.displayName',
    },
    prepare({status, startedAt, estimatedUsd, modelCalls, audience, email, name}) {
      const account = email || name || (audience === 'guest' ? 'Guest' : 'Signed-in reader')
      return {
        title: account,
        subtitle: `${status} · ${startedAt} · ${modelCalls ?? 0} model calls · $${(estimatedUsd ?? 0).toFixed(6)} estimated`,
      }
    },
  },
})

export const companionQuota = defineType({
  name: 'companionQuota', title: 'Companion daily quota guard', type: 'document', readOnly: true,
  fields: [
    defineField({name: 'day', type: 'string'}),
    defineField({name: 'count', type: 'number'}),
    defineField({name: 'lastStartedAt', type: 'number'}),
  ],
})
