import assert from 'node:assert/strict'
import test from 'node:test'
import {
  linkRecommendationTitles,
  plainRecommendationTitles,
  stripCompanionSources,
} from '../src/lib/companion-links'

const selections = [
  {book: {_id: 'book.one', slug: 'the-first-book', title: 'The First Book'}},
  {book: {_id: 'book.two', title: 'Book Two (Again)'}},
]

test('hides source URLs and source lists from companion replies', () => {
  assert.equal(
    stripCompanionSources('The Reader is in the catalog.\n\nSources:\nhttps://example.com/oprah'),
    'The Reader is in the catalog.',
  )
})

test('links recommendation titles without requiring one exact list format', () => {
  const answer = linkRecommendationTitles(
    '1) The First Book by Ada Author\n2. Book Two (Again) - Bea Writer',
    selections,
  )

  assert.match(answer, /\[The First Book\]\(\/books\/the-first-book\)/)
  assert.match(answer, /\[Book Two \(Again\)\]\(\/books\/book.two\)/)
})

test('preserves existing links and appends a link when the writer omits a title', () => {
  const answer = linkRecommendationTitles(
    '1. [The First Book](/books/the-first-book) — Ada Author\nA second choice has a dreamlike atmosphere.',
    selections,
  )

  assert.equal(answer.match(/\/books\/the-first-book/g)?.length, 1)
  assert.match(answer, /Open in Everlogue: \[Book Two \(Again\)\]\(\/books\/book.two\)$/)
})

test('finds titles in older saved recommendations that do not have links', () => {
  assert.deepEqual(
    plainRecommendationTitles(
      '1. The First Book — Ada Author\nWhy it fits.\n\n2) Book Two (Again) - Bea Writer',
    ),
    ['The First Book', 'Book Two (Again)'],
  )
  assert.deepEqual(
    plainRecommendationTitles('1. [The First Book](/books/the-first-book) — Ada Author'),
    [],
  )
})
