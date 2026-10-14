'use server'

import {requireReader} from './reader'
import {importGoodreadsBooks, loadReaderLibraryIndex} from './goodreads-service'

export async function getReaderLibraryIndex() {
  const reader = await requireReader()
  const index = await loadReaderLibraryIndex(reader.readerId)
  return {keys: [...index.keys()]}
}

export async function importGoodreadsBatch(input: unknown) {
  return importGoodreadsBooks(await requireReader(), input)
}
