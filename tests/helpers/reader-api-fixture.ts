import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {evaluate, parse} from 'groq-js'
import {stableId, slugify} from '../../src/lib/validation'

const require = createRequire(import.meta.url)
export type Doc = {_id: string; _type: string; [key: string]: unknown}
export const reference = (_ref: string) => ({_type: 'reference', _ref})

type Auth = {isAuthenticated: boolean; userId: string | null}

/** Actual GROQ evaluation and mutation semantics, entirely in memory. */
export function readerDatabase() {
  const docs = new Map<string, Doc>()
  let sequence = 0
  const calls: string[] = []
  let failure = false
  for (const who of ['a', 'b']) {
    const readerId = `reader-${who}`
    docs.set(readerId, {_id: readerId, _type: 'readerProfile', clerkUserId: `user_${who}`, displayName: who.toUpperCase(), email: `${who}@example.test`})
    for (const [kind, name] of [['wantToRead', 'Want to Read'], ['currentlyReading', 'Currently Reading'], ['finished', 'Read'], ['custom', 'Favorites']]) {
      const id = stableId(['shelf', readerId, kind])
      docs.set(id, {_id: id, _type: 'shelf', owner: reference(readerId), kind, name, slug: {current: slugify(name)}, visibility: 'private'})
    }
  }
  docs.set('book', {_id: 'book', _type: 'book', title: 'Shared work', authors: ['Author'], googleBooksId: 'volume', isbn13: '9780306406157'})
  docs.set('edition', {_id: 'edition', _type: 'edition', book: reference('book'), isbn13: '9780306406157', editorialLocked: true})
  docs.set('other-book', {_id: 'other-book', _type: 'book', title: 'Another work', authors: ['Author']})
  docs.set('progress-b', {_id: 'progress-b', _type: 'readingProgress', reader: reference('reader-b'), book: reference('book'), status: 'finished'})
  docs.set('entry-b', {_id: 'entry-b', _type: 'shelfEntry', shelf: reference('shelf-reader-b-finished'), book: reference('book'), addedAt: '2020-01-01'})
  docs.set('rating-b', {_id: 'rating-b', _type: 'rating', reader: reference('reader-b'), book: reference('book'), value: 2})
  docs.set('review-b', {_id: 'review-b', _type: 'review', reader: reference('reader-b'), book: reference('book'), title: 'Private B', body: 'B only', visibility: 'private'})

  function patch(id: string, pending?: (() => void)[]) {
    const updates: (() => void)[] = []
    const builder = {
      set(fields: object) { updates.push(() => { Object.assign(docs.get(id)!, fields) }); return builder },
      setIfMissing(fields: object) {
        updates.push(() => { const doc = docs.get(id)!; for (const [key, value] of Object.entries(fields)) if (doc[key] === undefined) doc[key] = value })
        return builder
      },
      unset(keys: string[]) { updates.push(() => { for (const key of keys) delete docs.get(id)![key] }); return builder },
      async commit() { updates.forEach(fn => fn()) },
    }
    pending?.push(() => updates.forEach(fn => fn()))
    return builder
  }
  const client = {
    async fetch(query: string, params: Record<string, unknown> = {}, options?: {cache?: string}) {
      calls.push(query)
      if (failure) throw new Error('upstream token=must-not-leak')
      if (options?.cache !== 'no-store') throw new Error('Private query must be uncached')
      return (await evaluate(parse(query), {dataset: [...docs.values()], params})).get()
    },
    patch,
    async delete(id: string) { docs.delete(id) },
    async createOrReplace(doc: Doc) { docs.set(doc._id, structuredClone(doc)) },
    transaction() {
      const pending: (() => void)[] = []
      const tx = {
        create(doc: Omit<Doc, '_id'> & {_id?: string}) {
          const id = doc._id || `generated-${++sequence}`
          pending.push(() => {
            if (docs.has(id)) throw Object.assign(new Error('Conflict'), {statusCode: 409})
            docs.set(id, structuredClone({...doc, _id: id}) as Doc)
          })
          return tx
        },
        createIfNotExists(doc: Doc) { pending.push(() => { if (!docs.has(doc._id)) docs.set(doc._id, structuredClone(doc)) }); return tx },
        delete(id: string) { pending.push(() => { docs.delete(id) }); return tx },
        patch(id: string, build: ((builder: ReturnType<typeof patch>) => unknown) | {set: object}) {
          if (typeof build === 'function') build(patch(id, pending))
          else patch(id, pending).set(build.set)
          return tx
        },
        serialize() { return pending },
        async commit() { pending.forEach(fn => fn()) },
      }
      return tx
    },
  }
  return {docs, calls, client, fail: () => { failure = true }}
}

export async function apiFixture() {
  const db = readerDatabase()
  let identity: Auth = {isAuthenticated: true, userId: 'user_a'}
  const invalidated: string[] = []
  const googleCalls: string[] = []
  const fixtures = {
    auth: async () => identity,
    currentUser: async () => { throw new Error('Unexpected live Clerk user lookup') },
    privateClient: db.client,
    writeClient: () => db.client,
    revalidatePath: (path: string) => invalidated.push(path),
    fetchGoogleVolume: async (id: string) => {
      googleCalls.push(id)
      if (id === 'new-volume') return {id, volumeInfo: {title: 'New catalog work', authors: ['New author']}}
      return id === 'volume' ? {id, volumeInfo: {title: 'Shared work', authors: ['Author'], industryIdentifiers: [{type: 'ISBN_13', identifier: '9780306406157'}]}} : null
    },
  }
  const result = await build({
    stdin: {contents: `
      export * as profile from './src/app/api/reader/profile/route';
      export * as library from './src/app/api/reader/library/route';
      export * as shelf from './src/app/api/reader/shelf-status/route';
      export * as rating from './src/app/api/reader/rating/route';
      export * as web from './src/lib/server-actions';
    `, resolveDir: process.cwd()},
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', external: ['reader-api-fixture'],
    define: {'process.env.CLERK_SECRET_KEY': '"sk_test_fixture_only"'},
    plugins: [{name: 'external-boundaries', setup(builder) {
      builder.onResolve({filter: /^(server-only|@clerk\/nextjs\/server|next\/cache|@\/sanity\/client|\.\/google-books-api)$/}, args => ({path: args.path, namespace: 'fixture'}))
      builder.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({contents: args.path === 'server-only' ? '' : `
        const f = require('reader-api-fixture');
        export const {auth, currentUser, privateClient, writeClient, revalidatePath, fetchGoogleVolume} = f;
      `}))
    }}],
  })
  const loaded = {exports: {} as {
    profile: {GET: (request: Request) => Promise<Response>}
    library: {GET: (request: Request) => Promise<Response>}
    shelf: {PUT: (request: Request) => Promise<Response>}
    rating: {PUT: (request: Request) => Promise<Response>}
    web: {saveShelfStatusAction: (book: {source: string; id: string}, status: string | null) => Promise<void>; saveRatingAction: (id: string, value: number | null) => Promise<void>}
  }}
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(
    (id: string) => id === 'reader-api-fixture' ? fixtures : require(id), loaded, loaded.exports,
  )
  return {...db, ...loaded.exports, invalidated, googleCalls, authenticate: (auth: Auth) => { identity = auth }}
}

export function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://everlogue.test/api/reader/${path}`, {method: 'PUT', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)})
}
