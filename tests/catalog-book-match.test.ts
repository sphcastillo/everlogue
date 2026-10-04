import assert from 'node:assert/strict'
import {test} from 'node:test'
import {catalogWorkKey, findMatchingCatalogBook} from '../src/lib/catalog-book-match'

test('a Goodreads series suffix still matches the catalog title', () => {
  const match = findMatchingCatalogBook(
    {title: 'The Last Thing He Told Me (Hannah Hall, #1)', author: 'Laura Dave'},
    [{_id: 'catalog-1', title: 'The Last Thing He Told Me', authors: ['Laura Dave']}],
  )
  assert.equal(match?._id, 'catalog-1')
})

test('curly and straight apostrophes are treated as the same author', () => {
  const match = findMatchingCatalogBook(
    {title: 'The Marriage Portrait', author: "Maggie O'Farrell"},
    [{_id: 'catalog-2', title: 'The Marriage Portrait', authors: ['Maggie O’Farrell']}],
  )
  assert.equal(match?._id, 'catalog-2')
})

test('the same title by a different author is not a match', () => {
  assert.equal(
    findMatchingCatalogBook(
      {title: 'The Marriage Portrait', author: 'Someone Else'},
      [{_id: 'catalog-2', title: 'The Marriage Portrait', authors: ['Maggie O’Farrell']}],
    ),
    null,
  )
})

test('work keys collapse series text and punctuation', () => {
  assert.equal(
    catalogWorkKey('The Last Thing He Told Me (Hannah Hall, #1)', 'Laura Dave'),
    catalogWorkKey('The Last Thing He Told Me', 'Laura Dave'),
  )
})
