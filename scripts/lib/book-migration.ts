import {randomUUID} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {slugify} from '../../src/lib/validation'

export type MigrationDocument = {_id: string; _type: string; _rev?: string; [key: string]: unknown}
export type BookMigrationPlan = {
  idMap: Record<string, string>
  creates: MigrationDocument[]
  patches: {id: string; revision: string; set: Record<string, unknown>; unset: string[]}[]
  deletes: {id: string; revision: string}[]
  expected: MigrationDocument[]
  summary: {worksConverted: number; booksBefore: number; booksAfter: number; referencesUpdated: number; documentsUpdated: number}
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const ref = (value: unknown) => object(value)._ref
const baseId = (id: string) => id.replace(/^drafts\./, '')
export const content = (doc: MigrationDocument) => Object.fromEntries(Object.entries(doc).filter(([key]) => !['_rev', '_createdAt', '_updatedAt'].includes(key)))

export function planBookMigration(documents: MigrationDocument[], newId: () => string = randomUUID): BookMigrationPlan {
  const originals = new Map(documents.map((doc) => [doc._id, doc]))
  const works = documents.filter((doc) => doc._type === 'work')
  if (works.some((doc) => doc._id.startsWith('versions.'))) throw new Error('Resolve content-release versions of legacy works before migrating.')
  const ids = new Map<string, string>()
  for (const work of works) {
    const oldBase = baseId(work._id)
    if (!ids.has(oldBase)) {
      const id = newId()
      if (originals.has(id) || [...ids.values()].includes(id)) throw new Error('A generated book ID is already in use.')
      ids.set(oldBase, id)
    }
  }
  for (const work of works) if (work._id.startsWith('drafts.')) ids.set(work._id, `drafts.${ids.get(baseId(work._id))}`)

  let referencesUpdated = 0
  function rewrite(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(rewrite)
    if (value === null || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, child]) => {
      if (key === '_ref' && typeof child === 'string' && ids.has(child)) {
        referencesUpdated++
        return [key, ids.get(child)]
      }
      if (key === '_strengthenOnPublish' && object(child).type === 'work') return [key, {...object(child), type: 'book'}]
      return [key, rewrite(child)]
    }))
  }

  const expected = documents.map((original): MigrationDocument => {
    const doc = rewrite(original) as MigrationDocument
    if (original._type === 'work') {
      doc._id = ids.get(original._id)!
      doc._type = 'book'
      doc.legacyWorkIds = [...new Set([...(Array.isArray(doc.legacyWorkIds) ? doc.legacyWorkIds : []), baseId(original._id)])]
    }
    if (ref(doc.work)) {
      if (doc.book && !isDeepStrictEqual(doc.book, doc.work)) throw new Error(`Conflicting book references on ${original._id}`)
      doc.book = doc.work
      delete doc.work
    }
    if (['editorialCollection', 'celebritySelection'].includes(doc._type) && Array.isArray(doc.works)) {
      if (doc.books && !isDeepStrictEqual(doc.books, doc.works)) throw new Error(`Conflicting collection contents on ${original._id}`)
      doc.books = doc.works
      delete doc.works
    }
    if (doc._type === 'edition' && doc.firstPublicationOfWork !== undefined) {
      if (doc.firstPublicationOfBook !== undefined && doc.firstPublicationOfBook !== doc.firstPublicationOfWork) throw new Error(`Conflicting edition dates on ${original._id}`)
      doc.firstPublicationOfBook = doc.firstPublicationOfWork
      delete doc.firstPublicationOfWork
    }
    if (doc._type === 'book') {
      const authors = Array.isArray(doc.authors) ? doc.authors : []
      const references = authors.filter((author) => ref(author))
      if (references.length) {
        doc.authorReferences = [...(Array.isArray(doc.authorReferences) ? doc.authorReferences : []), ...references]
        doc.authors = authors.map((author) => {
          if (typeof author === 'string') return author
          const authorId = ref(author)
          const name = typeof authorId === 'string' ? originals.get(authorId)?.name : undefined
          if (typeof name !== 'string') throw new Error(`Cannot resolve an author for ${original._id}`)
          return name
        })
      }
      if (Array.isArray(doc.authors) && doc.authors.some((author) => typeof author !== 'string')) throw new Error(`Invalid authors on ${original._id}`)
      if (!object(doc.slug).current) doc.slug = {_type: 'slug', current: `${slugify(String(doc.title || 'book')).slice(0, 70)}-${baseId(doc._id).slice(-12)}`}
    }
    return doc
  })
  const creates: MigrationDocument[] = []
  const patches: BookMigrationPlan['patches'] = []
  const deletes: BookMigrationPlan['deletes'] = []
  for (let index = 0; index < documents.length; index++) {
    const before = documents[index], after = expected[index]
    if (before._type === 'work') {
      if (!before._rev) throw new Error(`Missing revision on ${before._id}`)
      creates.push(content(after) as MigrationDocument)
      deletes.push({id: before._id, revision: before._rev})
    } else if (!isDeepStrictEqual(content(before), content(after))) {
      if (!before._rev) throw new Error(`Missing revision on ${before._id}`)
      const fields = Object.entries(content(after)).filter(([key, value]) => !key.startsWith('_') && !isDeepStrictEqual(before[key], value))
      const unset = Object.keys(before).filter((key) => !key.startsWith('_') && !(key in after))
      patches.push({id: before._id, revision: before._rev, set: Object.fromEntries(fields), unset})
    }
  }
  return {
    idMap: Object.fromEntries(ids), creates, patches, deletes, expected,
    summary: {
      worksConverted: works.length,
      booksBefore: documents.filter((doc) => doc._type === 'book').length,
      booksAfter: expected.filter((doc) => doc._type === 'book').length,
      referencesUpdated, documentsUpdated: patches.length,
    },
  }
}

export function verifyBookMigration(plan: BookMigrationPlan, actual: MigrationDocument[]) {
  const byId = new Map(actual.map((doc) => [doc._id, doc]))
  for (const expected of plan.expected) {
    const saved = byId.get(expected._id)
    if (!saved || !isDeepStrictEqual(content(saved), content(expected))) throw new Error(`Verification mismatch for ${expected._id}`)
  }
  const oldIds = new Set(plan.deletes.map((doc) => doc.id))
  function verifyReferences(value: unknown) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(verifyReferences); return }
    const record = object(value)
    if (typeof record._ref === 'string' && oldIds.has(record._ref)) throw new Error('A reference still points to a legacy work.')
    Object.values(record).forEach(verifyReferences)
  }
  for (const doc of actual) {
    if (doc._type === 'work' || oldIds.has(doc._id)) throw new Error('Legacy work documents remain.')
    verifyReferences(doc)
  }
}
