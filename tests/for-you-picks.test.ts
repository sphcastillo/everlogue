import {test} from 'node:test'
import assert from 'node:assert/strict'
import {rankForYouBooks} from '../src/lib/for-you-picks'

test('For you prefers books that share loved genres, then shelf genres, then authors', () => {
  const ranked = rankForYouBooks(
    [
      {_id: 'popular', ratingStats: {count: 90}, genres: [{title: 'History'}]},
      {_id: 'same-author', authors: ['Toni Morrison'], genres: [{title: 'Essays'}], ratingStats: {count: 2}},
      {_id: 'same-genre', genres: [{title: 'Family Saga'}], ratingStats: {count: 4}},
      {_id: 'loved-genre', genres: [{title: 'Literary Fiction'}, {title: 'Family Saga'}], ratingStats: {count: 1}},
    ],
    {
      genres: ['Family Saga', 'Coming-Of-Age Fiction'],
      lovedGenres: ['Literary Fiction'],
      authors: ['Toni Morrison'],
    },
  ).map((book) => book._id)

  assert.deepEqual(ranked, ['loved-genre', 'same-genre', 'same-author', 'popular'])
})

test('For you stops at ten and keeps a shorter matching row', () => {
  const books = Array.from({length: 12}, (_, index) => ({
    _id: `book-${index}`,
    genres: [{title: 'Mystery'}],
  }))

  assert.equal(rankForYouBooks(books, {genres: ['Mystery']}).length, 10)
  assert.equal(rankForYouBooks(books.slice(0, 4), {genres: ['Mystery']}).length, 4)
})
