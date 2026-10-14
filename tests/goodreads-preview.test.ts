import assert from 'node:assert/strict'
import {test} from 'node:test'
import {parseGoodreadsCsv} from '../src/lib/goodreads-csv'
import {buildLibraryIndex, partitionGoodreadsBooks, summarizeGoodreadsPreview} from '../src/lib/goodreads-library'

test('preview counts total, matched, unmatched, duplicates, and invalid rows', () => {
  const preview = parseGoodreadsCsv(
    'Book Id,Title,Author,ISBN13,Exclusive Shelf\n' +
    '1,Owned,Author,,read\n' +
    '1,Owned,Author,,read\n' +
    '2,New,Author,,to-read\n' +
    '3,Bad,Author,,abandoned\n',
  )
  const index = buildLibraryIndex([{bookId: 'book-1', title: 'Owned', authors: ['Author']}])
  const {owned, missing} = partitionGoodreadsBooks(preview.books, index)
  const summary = summarizeGoodreadsPreview(preview, owned, missing)
  assert.equal(summary.total, 4)
  assert.equal(summary.valid, 2)
  assert.equal(summary.matched, 1)
  assert.equal(summary.unmatched, 1)
  assert.equal(summary.duplicates, 1)
  assert.equal(summary.invalid, 1)
  assert.equal(summary.shelves.finished, 1)
  assert.equal(summary.shelves.wantToRead, 1)
})
