import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'

// Exercise the actual handlers with service boundaries stubbed; no live reader data.
async function route(kind: 'shelves' | 'for-you', options: {signedIn?: boolean; failure?: boolean} = {}) {
  const result = await build({
    entryPoints: [`src/app/api/home/${kind}/route.ts`],
    bundle: true, write: false, platform: 'node', format: 'esm',
    plugins: [{name: 'service-stubs', setup(builder) {
      builder.onResolve({filter: /^@\/lib\/(home-shelves|reader)$/}, args => ({path: args.path, namespace: 'stub'}))
      builder.onLoad({filter: /.*/, namespace: 'stub'}, args => ({contents: args.path.endsWith('reader') ? `
        export async function getOptionalReader() { return ${options.signedIn ? '{readerId: "verified-reader"}' : 'null'} }
        export function privateHeaders() { return {'Cache-Control': 'private, no-store, max-age=0'} }
      ` : `
        export async function getPublicHomeShelves() { ${options.failure ? 'throw new Error("upstream unavailable")' : 'return [{id: "strange", books: []}]'} }
        export async function getForYouHomeShelf(readerId) {
          ${options.failure ? 'throw new Error("upstream unavailable")' : 'return {hasLibrary: true, tabs: [{id: "forYou", books: [{_id: readerId}]}]}'}
        }
      `}))
    }}],
  })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}

test('public endpoint returns tabs without a reader session', async () => {
  const {GET} = await route('shelves')
  const response = await GET()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {tabs: [{id: 'strange', books: []}]})
})

test('personal endpoint rejects guests and forbids caching', async () => {
  const {GET} = await route('for-you')
  const response = await GET()
  assert.equal(response.status, 401)
  assert.match(response.headers.get('cache-control')!, /private, no-store/)
})

test('personal endpoint uses the server-resolved reader', async () => {
  const {GET} = await route('for-you', {signedIn: true})
  const response = await GET()
  assert.equal(response.status, 200)
  assert.equal((await response.json()).tabs[0].books[0]._id, 'verified-reader')
  assert.match(response.headers.get('cache-control')!, /private, no-store/)
})

test('upstream errors return safe retryable responses without caching', async () => {
  for (const kind of ['shelves', 'for-you'] as const) {
    const {GET} = await route(kind, {signedIn: true, failure: true})
    const response = await GET()
    assert.equal(response.status, 503)
    assert.match(response.headers.get('cache-control')!, /no-store/)
    assert.doesNotMatch(JSON.stringify(await response.json()), /upstream unavailable/)
  }
})
