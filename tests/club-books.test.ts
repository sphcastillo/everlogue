import assert from 'node:assert/strict'
import {test} from 'node:test'
import {latestClubEntries} from '../src/lib/club-books'

test('shows the newest club add first and the first book last', () => {
  const ordered = latestClubEntries([
    {selectionNumber: 1, book: {_id: 'first-ever'}},
    {selectionNumber: 2, book: {_id: 'middle'}},
    {selectionNumber: 2, book: {_id: 'middle'}},
    {selectionNumber: 3, book: {_id: 'latest'}},
    {isLatestAddition: true, book: {_id: 'just-added'}},
  ])

  assert.deepEqual(
    ordered.map((entry) => entry.book?._id),
    ['just-added', 'latest', 'middle', 'first-ever'],
  )
})
