import assert from 'node:assert/strict'
import {test} from 'node:test'
import {planBookMigration, verifyBookMigration, type MigrationDocument} from '../scripts/lib/book-migration'

const ref = (_ref: string) => ({_type: 'reference', _ref})
const document = (_id: string, _type: string, fields: Record<string, unknown> = {}): MigrationDocument => ({_id, _type, _rev: `rev-${_id}`, ...fields})

test('moves CSV books and every relationship without losing ratings, dates, editions, or club membership', () => {
  const input = [
    document('author', 'author', {name: 'Lisa Jewell'}),
    document('csv-book', 'work', {title: 'None of This Is True', authors: [{...ref('author'), _key: 'a'}], goodreadsBookId: '62334530', slug: {_type: 'slug', current: 'none-of-this-is-true'}, ratingStats: {count: 1, average: 4}}),
    document('edition', 'edition', {work: ref('csv-book'), isbn13: '9781982179007', coverOverride: {asset: ref('asset')}, firstPublicationOfWork: false}),
    document('rating-reader-csv-book', 'rating', {reader: ref('reader'), work: ref('csv-book'), value: 4}),
    document('progress-reader-csv-book', 'readingProgress', {reader: ref('reader'), work: ref('csv-book'), status: 'finished', finishedAt: '2026-07-09', readCount: 1, edition: ref('edition')}),
    document('entry', 'shelfEntry', {shelf: ref('shelf'), work: ref('csv-book'), addedAt: '2026-06-01', edition: ref('edition')}),
    document('club', 'curatedCollection', {books: [{_key: 'pick', book: ref('csv-book'), month: 'July'}]}),
    document('editorial', 'editorialCollection', {works: [{...ref('csv-book'), _key: 'a'}]}),
    document('poll', 'poll', {options: [{...ref('csv-book'), _key: 'a'}]}),
    document('vote', 'vote', {option: ref('csv-book')}),
    document('thread', 'discussionThread', {work: ref('csv-book')}),
    document('other-book', 'book', {title: 'A Club Book', authors: ['An Author'], cover: {url: 'https://example.com/cover.jpg'}}),
  ]
  const unchanged = structuredClone(input)
  const plan = planBookMigration(input, () => 'new-book-id')
  assert.deepEqual(input, unchanged)
  assert.equal(plan.summary.worksConverted, 1)
  const book = plan.creates[0]
  assert.equal(book._type, 'book')
  assert.deepEqual(book.authors, ['Lisa Jewell'])
  assert.deepEqual(book.authorReferences, [{...ref('author'), _key: 'a'}])
  assert.deepEqual(book.slug, input[1].slug)
  const saved = new Map(plan.expected.map((doc) => [doc._id, doc]))
  assert.equal(saved.get('rating-reader-csv-book')?.value, 4)
  assert.deepEqual(saved.get('rating-reader-csv-book')?.book, ref('new-book-id'))
  assert.equal(saved.get('progress-reader-csv-book')?.finishedAt, '2026-07-09')
  assert.equal(saved.get('progress-reader-csv-book')?.readCount, 1)
  assert.equal(saved.get('entry')?.addedAt, '2026-06-01')
  assert.equal(saved.get('edition')?.firstPublicationOfBook, false)
  assert.deepEqual(saved.get('edition')?.coverOverride, input[2].coverOverride)
  assert.deepEqual(saved.get('editorial')?.books, [{...ref('new-book-id'), _key: 'a'}])
  assert.deepEqual(saved.get('club')?.books, [{_key: 'pick', book: ref('new-book-id'), month: 'July'}])
  assert.deepEqual(saved.get('vote')?.option, ref('new-book-id'))
  verifyBookMigration(plan, plan.expected)
  const repeat = planBookMigration(plan.expected)
  assert.equal(repeat.creates.length + repeat.patches.length + repeat.deletes.length, 0)
})

test('keeps draft and published books paired', () => {
  const plan = planBookMigration([
    document('old', 'work', {title: 'Published', authors: []}),
    document('drafts.old', 'work', {title: 'Draft', authors: []}),
  ], () => 'new')
  assert.deepEqual(plan.creates.map((doc) => doc._id), ['new', 'drafts.new'])
})

test('refuses unresolved author names and conflicting references', () => {
  assert.throws(() => planBookMigration([document('old', 'work', {authors: [ref('missing')]})]), /Cannot resolve an author/)
  assert.throws(() => planBookMigration([document('rating', 'rating', {work: ref('a'), book: ref('b')})]), /Conflicting book references/)
})

test('verification catches lost ratings and lingering legacy references', () => {
  const plan = planBookMigration([
    document('old', 'work', {authors: []}),
    document('rating', 'rating', {work: ref('old'), value: 4}),
  ], () => 'new')
  const damaged = structuredClone(plan.expected)
  damaged[1].value = null
  assert.throws(() => verifyBookMigration(plan, damaged), /Verification mismatch/)
  assert.throws(() => verifyBookMigration(plan, [...plan.expected, document('extra', 'vote', {option: ref('old')})]), /reference still points/)
})
