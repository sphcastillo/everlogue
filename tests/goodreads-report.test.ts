import assert from 'node:assert/strict'
import {test} from 'node:test'
import {importReportNews, importRetriesExhausted} from '../src/lib/goodreads-report'

test('a title can be retried twice, then it is handed to the librarian', () => {
  assert.equal(importRetriesExhausted(0), false)
  assert.equal(importRetriesExhausted(1), false)
  assert.equal(importRetriesExhausted(2), true)
})

test('a clean import tells the reader the books are in', () => {
  const news = importReportNews({imported: 12, updated: 0, skipped: 196, failed: 0})
  assert.equal(news.tone, 'success')
  assert.match(news.headline, /good news/i)
  assert.match(news.body, /12 books/)
  assert.match(news.body, /196 titles were already/)
})

test('a re-upload of an existing library says they are caught up', () => {
  const news = importReportNews({imported: 0, updated: 0, skipped: 208, failed: 0})
  assert.equal(news.tone, 'current')
  assert.match(news.body, /already in your library/)
})

test('partial failure reports both the wins and the misses', () => {
  const news = importReportNews({imported: 18, updated: 1, skipped: 0, failed: 3})
  assert.equal(news.tone, 'mixed')
  assert.match(news.body, /18 books landed/)
  assert.match(news.body, /3 titles/)
})

test('a complete miss tells them Everlogue still has the work', () => {
  const news = importReportNews({imported: 0, updated: 0, skipped: 0, failed: 4})
  assert.equal(news.tone, 'failed')
  assert.match(news.body, /retry/i)
})
