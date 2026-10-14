import assert from 'node:assert/strict'
import {test} from 'node:test'
import {csvCell, goodreadsBookSchema, parseCsv, parseGoodreadsCsv} from '../src/lib/goodreads-csv'

const header = 'Book Id,Title,Author,ISBN13,Exclusive Shelf,Date Added,Date Read,Read Count'

test('imports decimal Goodreads ratings while treating zero and blanks as unrated', () => {
  const preview = parseGoodreadsCsv('Title,Author,Exclusive Shelf,My Rating\nA,Author,read,4.0\nB,Author,read,5.0\nC,Author,to-read,0\nD,Author,read,')
  assert.equal(preview.issues.length, 0)
  assert.deepEqual(preview.books.map((book) => book.rating), [4, 5, undefined, undefined])
})

test('reports invalid nonzero ratings instead of silently dropping them', () => {
  const preview = parseGoodreadsCsv('Title,Author,Exclusive Shelf,My Rating\nA,Author,read,unknown\nB,Author,read,6')
  assert.equal(preview.books.length, 0)
  assert.equal(preview.issues.length, 2)
  assert.match(preview.issues[0].message, /My Rating/)
})

test('parses BOM, CRLF, quoted commas/newlines, escaped quotes and Goodreads ISBNs', () => {
  const data = parseGoodreadsCsv('\uFEFF' + header + '\r\n' +
    '123,"A book, with ""quotes""\nand lines",A Writer,"=""9781234567890""",read,2020/1/2,2021/02/28,2\r\n')
  assert.equal(data.issues.length, 0)
  assert.deepEqual(data.books[0], {
    row: 2, goodreadsId: '123', title: 'A book, with "quotes"\nand lines', author: 'A Writer',
    isbn13: '9781234567890', isbn10: undefined, status: 'finished',
    addedAt: '2020-01-02', finishedAt: '2021-02-28', readCount: 2, publicationYear: undefined,
  })
})

test('parses my rating and date read from Goodreads columns', () => {
  const preview = parseGoodreadsCsv(
    'Title,Author,Exclusive Shelf,My Rating,Date Added,Date Read\nOne,Author,read,4,2020/01/02,2021/03/04',
  )
  assert.equal(preview.issues.length, 0)
  assert.equal(preview.books[0].rating, 4)
  assert.equal(preview.books[0].addedAt, '2020-01-02')
  assert.equal(preview.books[0].finishedAt, '2021-03-04')
})

test('rejects a Date Added that would place reading start after Date Read', () => {
  const preview = parseGoodreadsCsv(
    'Title,Author,Exclusive Shelf,Date Added,Date Read\nOne,Author,read,2022/01/01,2021/12/31',
  )
  assert.equal(preview.books.length, 0)
  assert.match(preview.issues[0].message, /Date Added must not be after Date Read/)
})

test('maps all three shelves without inventing reading dates', () => {
  const preview = parseGoodreadsCsv(header + '\n1,One,Author,,read,,,1\n2,Two,Author,,to-read,,,0\n3,Three,Author,,currently-reading,,,1')
  assert.deepEqual(preview.books.map((book) => book.status), ['finished', 'wantToRead', 'currentlyReading'])
  assert.ok(preview.books.every((book) => !book.addedAt && !book.finishedAt))
})

test('reports invalid rows, unsupported shelves and duplicates without losing valid books', () => {
  const preview = parseGoodreadsCsv(header + '\n1,One,Author,,read,,,1\n1,One,Author,,read,,,1\n2,Two,Author,,abandoned,,,0\n3,Three,Author,,read,,2024/02/30,1\n4,Four,,,read,,,1')
  assert.equal(preview.books.length, 1)
  assert.equal(preview.issues.length, 4)
  assert.match(preview.issues[0].message, /Duplicate/)
  assert.match(preview.issues[1].message, /Unsupported shelf/)
  assert.match(preview.issues[2].message, /Invalid reading date/)
})

test('rejects empty files, wrong headers and malformed quoting', () => {
  assert.throws(() => parseGoodreadsCsv(''), /empty/)
  assert.throws(() => parseGoodreadsCsv('Title,Author\nOne,Someone'), /exclusive shelf/)
  assert.throws(() => parseGoodreadsCsv('Title,Author,Exclusive Shelf,Title\nA,B,read,A'), /duplicate column/)
  assert.throws(() => parseCsv('"unfinished'), /unfinished/)
  assert.throws(() => parseCsv('"closed"bad'), /quotation/)
})

test('validates untrusted server input and neutralizes spreadsheet formulas on export', () => {
  assert.equal(goodreadsBookSchema.safeParse({row: 2, title: 'Book', author: 'A', status: 'custom'}).success, false)
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"')
  assert.equal(csvCell('Normal, title'), '"Normal, title"')
  assert.equal(csvCell('  @SUM(1)'), '"\'  @SUM(1)"')
})
