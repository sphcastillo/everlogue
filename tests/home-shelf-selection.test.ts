import {test} from 'node:test'
import assert from 'node:assert/strict'
import {publicShelfTabs, type ShelfPickBook, type ShelfPicks} from '../src/lib/home-shelf-selection'

const book = (_id: string, pageCount = 120): ShelfPickBook => ({
  _id, title: _id, pageCount, cover: {coverOverride: {asset: {url: 'https://cdn.sanity.io/cover.jpg'}}},
})
const picks = (overrides: Partial<ShelfPicks>): ShelfPicks => ({collections: [], strange: [], feelings: [], short: [], ...overrides})

test('curated picks lead, duplicates are removed, and rows stop at ten', () => {
  const tabs = publicShelfTabs(picks({
    collections: [{slug: 'a-little-strange', books: [book('curated'), book('duplicate')]}],
    strange: [book('duplicate'), ...Array.from({length: 12}, (_, i) => book(`fallback-${i}`))],
  }))
  assert.deepEqual(tabs[0].books.map(b => b._id), ['curated', 'duplicate', ...Array.from({length: 8}, (_, i) => `fallback-${i}`)])
})

test('short shelf enforces page limits for curated and fallback books', () => {
  const tabs = publicShelfTabs(picks({
    collections: [{slug: 'short-and-sharp', books: [book('long', 251), book('unknown', 0), book('boundary', 250)]}],
    short: [book('negative', -1), book('shortest', 1), {...book('missing'), pageCount: null}],
  }))
  assert.deepEqual(tabs[2].books.map(b => b._id), ['boundary', 'shortest'])
})

test('all rows require an id, title and manual cover; empty rows retain stable labels', () => {
  const tabs = publicShelfTabs(picks({feelings: [book('good'), {...book('no-cover'), cover: null}, {...book('no-title'), title: ''}, book('')]}))
  assert.deepEqual(tabs.map(t => [t.id, t.books.length]), [['strange', 0], ['feelings', 1], ['short', 0]])
})
