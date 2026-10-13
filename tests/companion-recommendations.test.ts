import {test} from 'node:test'
import assert from 'node:assert/strict'
import {
  finalizeRecommendationGroups,
  hiddenRecommendationMarks,
  isHiddenRecommendation,
  recommendationCount,
} from '../src/lib/companion-recommendations'

test('profile recommendations count each catalog book once and skip hidden or missing books', () => {
  const hidden = hiddenRecommendationMarks('2026-10-13T180818.436Z-assistant:book.gone-girl')
  const groups = finalizeRecommendationGroups([
    {
      _key: 'later',
      recommendedAt: '2026-10-13T18:11:29.115Z',
      books: [
        {_id: 'book.not-quite', recommendationKey: 'later:book.not-quite'},
        {_id: 'book.dirty', recommendationKey: 'later:book.dirty'},
      ],
    },
    {
      _key: '2026-10-13T180818.436Z-assistant',
      recommendedAt: '2026-10-13T18:08:18.436Z',
      books: [
        {_id: 'book.gone-girl', recommendationKey: '2026-10-13T180818.436Z-assistant:book.gone-girl'},
        {_id: 'book.family', recommendationKey: '2026-10-13T180818.436Z-assistant:book.family'},
        {_id: 'book.not-quite', recommendationKey: '2026-10-13T180818.436Z-assistant:book.not-quite'},
      ].filter((book) => !isHiddenRecommendation(hidden, book.recommendationKey, book._id)),
    },
  ])

  assert.equal(recommendationCount(groups), 3)
  assert.deepEqual(groups.flatMap((group) => group.books.map((book) => book._id)), [
    'book.not-quite',
    'book.dirty',
    'book.family',
  ])
})
