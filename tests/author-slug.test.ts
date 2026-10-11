import assert from 'node:assert/strict'
import {test} from 'node:test'
import {authorSlug, uniqueAuthorSlug} from '../src/lib/author-slug'

test('author slugs match Studio Generate from the name', () => {
  assert.equal(authorSlug('Stacy Willingham'), 'stacy-willingham')
  assert.equal(authorSlug('J.K. Rowling'), 'jk-rowling')
  assert.equal(authorSlug("Maggie O'Farrell"), 'maggie-ofarrell')
  assert.equal(authorSlug('Alexander   Rose'), 'alexander-rose')
})

test('duplicate names keep the first slug and suffix later ones', () => {
  const taken = new Set<string>()
  const first = uniqueAuthorSlug('Stacy Willingham', taken)
  taken.add(first)
  const second = uniqueAuthorSlug('Stacy Willingham', taken)
  assert.equal(first, 'stacy-willingham')
  assert.equal(second, 'stacy-willingham-2')
})
