import assert from 'node:assert/strict'
import {test} from 'node:test'
import {firstSentence} from '../src/lib/club-title'

test('does not treat initials like V. as the end of the sentence', () => {
  const text =
    'The Book of V. weaves together the lives of three women: Esther in ancient Persia, Vivian, a politician’s wife in 1970s Washington, D.C., and Lily, a mother struggling with marriage and ambition in modern Brooklyn. Across vastly different worlds, each confronts expectations that threaten to define her life.'
  assert.equal(
    firstSentence(text),
    'The Book of V. weaves together the lives of three women: Esther in ancient Persia, Vivian, a politician’s wife in 1970s Washington, D.C., and Lily, a mother struggling with marriage and ambition in modern Brooklyn.',
  )
})
