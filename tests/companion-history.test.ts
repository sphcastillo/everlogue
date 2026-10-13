import {test} from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_COMPANION_HISTORY_MESSAGES,
  dedupeCompanionHistory,
  mergeCompanionHistory,
} from '../src/lib/companion-history-merge'

test('new companion turns append without duplicating saved messages', () => {
  const existing = [
    {_key: 'a', role: 'user' as const, text: 'What should I read next?', createdAt: '2026-10-04T23:00:00.000Z'},
    {_key: 'b', role: 'assistant' as const, text: 'Try Hamnet.', createdAt: '2026-10-04T23:00:10.000Z'},
  ]
  const incoming = [
    existing[0],
    existing[1],
    {role: 'user' as const, text: 'Something shorter', createdAt: '2026-10-13T17:33:00.000Z'},
  ]
  const merged = mergeCompanionHistory(existing, incoming)
  assert.equal(merged.length, 3)
  assert.equal(merged[2].text, 'Something shorter')
})

test('merged companion history keeps the newest messages at the cap', () => {
  const existing = Array.from({length: MAX_COMPANION_HISTORY_MESSAGES}, (_, index) => ({
    _key: `old-${index}`,
    role: index % 2 ? 'assistant' as const : 'user' as const,
    text: `Old ${index}`,
  }))
  const merged = mergeCompanionHistory(existing, [{role: 'user', text: 'Fresh start'}])
  assert.equal(merged.length, MAX_COMPANION_HISTORY_MESSAGES)
  assert.equal(merged.at(-1)?.text, 'Fresh start')
  assert.equal(merged[0]._key, 'old-1')
})

test('session saves without keys do not re-append the same turns', () => {
  const existing = [
    {_key: '2026-10-13T180805.596Z-user', role: 'user' as const, text: 'Find me a book', createdAt: '2026-10-13T18:08:05.596Z'},
    {_key: '2026-10-13T180818.436Z-assistant', role: 'assistant' as const, text: 'Try Hamnet.', createdAt: '2026-10-13T18:08:18.436Z'},
  ]
  const incoming = [
    {role: 'user' as const, text: 'Find me a book', createdAt: '2026-10-13T18:08:05.596Z'},
    {role: 'assistant' as const, text: 'Try Hamnet.', createdAt: '2026-10-13T18:08:18.436Z'},
    {role: 'user' as const, text: 'Something shorter', createdAt: '2026-10-13T18:11:17.305Z'},
  ]
  const merged = mergeCompanionHistory(existing, incoming)
  assert.equal(merged.length, 3)
  assert.equal(merged.filter(message => message.text === 'Try Hamnet.').length, 1)
})

test('dedupe drops repeated companion turns that share a key', () => {
  const messages = [
    {_key: 'same-assistant', role: 'assistant' as const, text: 'Try Hamnet.', createdAt: '2026-10-13T18:08:18.436Z'},
    {_key: 'same-assistant', role: 'assistant' as const, text: 'Try Hamnet.', createdAt: '2026-10-13T18:08:18.436Z'},
    {_key: 'later-user', role: 'user' as const, text: 'Thanks', createdAt: '2026-10-13T18:11:17.305Z'},
  ]
  const unique = dedupeCompanionHistory(messages)
  assert.equal(unique.length, 2)
  assert.equal(unique[1].text, 'Thanks')
})
