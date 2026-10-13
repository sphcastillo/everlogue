import assert from 'node:assert/strict'
import {test} from 'node:test'
import {generateKeyPairSync, sign} from 'node:crypto'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
import {NextRequest, type NextFetchEvent, type NextMiddleware} from 'next/server'
import type {ClerkMiddlewareAuth} from '@clerk/nextjs/server'
import {apiFixture, jsonRequest} from './helpers/reader-api-fixture'

const require = createRequire(import.meta.url)
const keys = generateKeyPairSync('rsa', {modulusLength: 2048})
const unrelatedKeys = generateKeyPairSync('rsa', {modulusLength: 2048})
// Ephemeral test keys only. No .env loading, Clerk account mutation or network calls.
const secretKey = 'sk_live_fixture_only'
const options = {
  publishableKey: `pk_live_${Buffer.from('clerk.fixture.test$').toString('base64')}`,
  secretKey,
  jwtKey: keys.publicKey.export({type: 'spki', format: 'pem'}).toString(),
}
// Load SDK constants with fixture keys, then restore the process environment.
const previousSecret = process.env.CLERK_SECRET_KEY
const previousEncryption = process.env.CLERK_ENCRYPTION_KEY
process.env.CLERK_SECRET_KEY = secretKey
process.env.CLERK_ENCRYPTION_KEY = 'fixture-only-encryption-key'
const {clerkMiddleware, getAuth} = require('@clerk/nextjs/server') as typeof import('@clerk/nextjs/server')
if (previousSecret === undefined) delete process.env.CLERK_SECRET_KEY
else process.env.CLERK_SECRET_KEY = previousSecret
if (previousEncryption === undefined) delete process.env.CLERK_ENCRYPTION_KEY
else process.env.CLERK_ENCRYPTION_KEY = previousEncryption

function token(overrides: Record<string, unknown> = {}, privateKey = keys.privateKey) {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({alg: 'RS256', typ: 'JWT', kid: 'fixture'})).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    v: 2, sub: 'user_a', sid: 'sess_fixture', iss: 'https://clerk.fixture.test',
    iat: now, nbf: now - 10, exp: now + 300, sts: 'active', fva: [0, -1], ...overrides,
  })).toString('base64url')
  const input = `${header}.${payload}`
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`
}

async function proxyFixture(development = false) {
  const configuration = development ? {
    ...options,
    publishableKey: `pk_test_${Buffer.from('fixture.clerk.accounts.dev$').toString('base64')}`,
    secretKey: 'sk_test_fixture_only',
  } : options
  const result = await build({entryPoints: ['src/proxy.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external'})
  const loaded = {exports: {} as {default: NextMiddleware}}
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(
    (id: string) => id === '@clerk/nextjs/server' ? {
      // Keep the real repository proxy callback and real SDK verifier; replace only key configuration.
      clerkMiddleware: (handler: (auth: ClerkMiddlewareAuth, request: NextRequest, event: NextFetchEvent) => ReturnType<NextMiddleware>) => clerkMiddleware(handler, configuration),
    } : require(id), loaded, loaded.exports,
  )
  return async (headers: Record<string, string>) => {
    const request = new NextRequest('https://everlogue.test/api/reader/library', {headers})
    const result = await loaded.exports.default(request, {waitUntil: () => {}} as unknown as NextFetchEvent)
    assert.ok(result instanceof Response)
    assert.equal(result.status, 200, 'API authentication must not redirect to a browser handshake')
    const forwarded = new Headers()
    // Reproduce Next's forwarding of the proxy's authenticated request headers.
    for (const name of (result.headers.get('x-middleware-override-headers') || '').split(',')) {
      const value = result.headers.get(`x-middleware-request-${name}`)
      if (name && value !== null) forwarded.set(name, value)
    }
    const auth = getAuth(new NextRequest(request.url, {headers: forwarded}), {secretKey: configuration.secretKey})
    return {isAuthenticated: auth.isAuthenticated, userId: auth.userId}
  }
}

test('actual Clerk proxy cryptographically accepts native Bearer sessions and isolates their reader data', async () => {
  const authenticate = await proxyFixture()
  const f = await apiFixture()
  const a = await authenticate({Authorization: `Bearer ${token()}`})
  assert.deepEqual(a, {isAuthenticated: true, userId: 'user_a'})
  f.authenticate(a)
  const response = await f.shelf.PUT(jsonRequest('shelf-status', {book: {source: 'catalog', id: 'book'}, status: 'finished'}))
  assert.equal(response.status, 200)
  assert.equal(f.docs.get('progress-reader-a-book')?.status, 'finished')
  assert.equal(f.docs.get('rating-b')?.value, 2)
  const b = await authenticate({Authorization: `Bearer ${token({sub: 'user_b'})}`})
  f.authenticate(b)
  const profile = await f.profile.GET(new Request('https://everlogue.test/api/reader/profile'))
  assert.equal((await profile.json()).profile.displayName, 'B')
})

test('existing web session cookie authentication still works through the actual proxy', async () => {
  const authenticate = await proxyFixture()
  const auth = await authenticate({Cookie: `__session=${token({azp: 'https://everlogue.test'})}; __client_uat=${Math.floor(Date.now() / 1000)}`, Origin: 'https://everlogue.test'})
  assert.deepEqual(auth, {isAuthenticated: true, userId: 'user_a'})
})

test('native Bearer authentication also works with development Clerk configuration without a browser handshake', async () => {
  const authenticate = await proxyFixture(true)
  const auth = await authenticate({Authorization: `Bearer ${token({iss: 'https://fixture.clerk.accounts.dev'})}`})
  assert.deepEqual(auth, {isAuthenticated: true, userId: 'user_a'})
})

test('missing, forged, expired, future and pending tokens cannot read or mutate private data', async () => {
  const authenticate = await proxyFixture()
  const f = await apiFixture()
  const now = Math.floor(Date.now() / 1000)
  for (const headers of [
    {},
    {Authorization: 'Bearer not-a-jwt'},
    {Authorization: `Bearer ${token({}, unrelatedKeys.privateKey)}`},
    {Authorization: `Bearer ${token({exp: now - 120})}`},
    {Authorization: `Bearer ${token({nbf: now + 120})}`},
    {Authorization: `Bearer ${token({sts: 'pending'})}`},
    {'x-clerk-auth-status': 'signed-in', 'x-clerk-auth-token': token(), 'x-clerk-auth-signature': 'forged'},
  ]) {
    const verified = await authenticate(headers as Record<string, string>)
    assert.equal(verified.isAuthenticated, false)
    f.authenticate(verified)
    const read = await f.library.GET(new Request('https://everlogue.test/api/reader/library'))
    assert.equal(read.status, 401)
    const write = await f.rating.PUT(jsonRequest('rating', {bookId: 'book', value: null}))
    assert.equal(write.status, 401)
  }
  assert.equal(f.calls.length, 0)
  assert.equal(f.docs.get('rating-b')?.value, 2)
})
