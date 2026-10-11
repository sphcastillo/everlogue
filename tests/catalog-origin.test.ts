import assert from 'node:assert/strict'
import {test} from 'node:test'
import {catalogClubNames, inferCatalogSource} from '../studio/lib/catalog-origin'

test('catalog origin lists the Watch club before the book is on a collection', () => {
  assert.deepEqual(
    catalogClubNames({
      clubs: [],
      celebrity: [],
      watch: ['oprah'],
      linked: ['oprah'],
    }),
    ["Oprah's Book Club"],
  )
  assert.equal(
    inferCatalogSource({catalogSource: 'bookClubImport', clubNames: []}),
    'bookClubImport',
  )
})

test('catalog origin keeps collection titles after Watch publish', () => {
  assert.deepEqual(
    catalogClubNames({
      clubs: ["Oprah's Book Club"],
      celebrity: [],
      watch: ['oprah'],
      linked: [],
    }),
    ["Oprah's Book Club"],
  )
})
