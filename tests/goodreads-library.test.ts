import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  buildLibraryIndex,
  findOwnedLibraryBook,
  libraryIndexFromKeys,
  libraryTitleKey,
  partitionGoodreadsBooks,
} from '../src/lib/goodreads-library'
import type {GoodreadsBook} from '../src/lib/goodreads-csv'

const owned: GoodreadsBook = {row: 2, title: 'A Book', author: 'An Author', status: 'finished'}
const extra: GoodreadsBook = {row: 3, title: 'New Book', author: 'Someone Else', status: 'wantToRead'}

test('re-uploads skip titles already on the reader’s shelves', () => {
  const index = buildLibraryIndex([
    {bookId: 'book-1', title: 'A Book', authors: ['An Author']},
  ])
  const {owned: already, missing} = partitionGoodreadsBooks([owned, extra], index)
  assert.deepEqual(already.map((book) => book.title), ['A Book'])
  assert.deepEqual(missing.map((book) => book.title), ['New Book'])
})

test('the same title by a different author is treated as missing', () => {
  const index = buildLibraryIndex([
    {bookId: 'book-1', title: 'A Book', authors: ['An Author']},
  ])
  assert.equal(
    findOwnedLibraryBook({...owned, author: 'Someone Else'}, index),
    null,
  )
})

test('key lists can rebuild a lookup for a faster re-upload', () => {
  const {owned: already, missing} = partitionGoodreadsBooks(
    [owned, extra],
    libraryIndexFromKeys([libraryTitleKey('A Book', 'An Author')]),
  )
  assert.deepEqual(already.map((book) => book.title), ['A Book'])
  assert.deepEqual(missing.map((book) => book.title), ['New Book'])
})

test('Goodreads IDs match even when the title text differs slightly', () => {
  const index = buildLibraryIndex([
    {bookId: 'book-1', title: 'A Book: A Novel', authors: ['An Author'], goodreadsId: '123'},
  ])
  assert.equal(
    findOwnedLibraryBook({...owned, title: 'A Book', goodreadsId: '123'}, index)?.bookId,
    'book-1',
  )
})
