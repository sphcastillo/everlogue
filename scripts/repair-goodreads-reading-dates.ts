/**
 * Rebuild one reader's Goodreads reading dates from the values already saved
 * during import. Dry-run by default.
 *
 * pnpm exec tsx scripts/repair-goodreads-reading-dates.ts <reader-id> --dataset <dataset> [--apply]
 */
import {config} from 'dotenv'
import {createClient} from '@sanity/client'
import {writeFile} from 'node:fs/promises'

type Progress = {
  _id: string
  _rev: string
  status: 'finished' | 'currentlyReading' | 'wantToRead'
  finishedAt?: string
  addedAt?: string
  title?: string
}

function argumentsFrom(command: string[]) {
  const readerId = command[0]
  const datasetIndex = command.indexOf('--dataset')
  const dataset = datasetIndex >= 0 ? command[datasetIndex + 1] : undefined
  const allowed = new Set([readerId, '--dataset', dataset, '--apply'])
  if (!readerId || !dataset || command.some((argument) => !allowed.has(argument))) {
    throw new Error('Usage: <reader-id> --dataset <dataset> [--apply]')
  }
  return {readerId, dataset, apply: command.includes('--apply')}
}

function replacement(progress: Progress) {
  const startedAt = progress.addedAt?.slice(0, 10)
  if (!startedAt) return null

  if (progress.status === 'wantToRead') {
    return {
      set: {readCount: 0},
      unset: ['startedAt', 'finishedAt', 'readingPeriod', 'readingHistory'],
    }
  }

  if (progress.status === 'currentlyReading') {
    return {
      set: {startedAt, readCount: 0},
      unset: ['finishedAt', 'readingPeriod', 'readingHistory'],
    }
  }

  if (!progress.finishedAt) {
    return {
      set: {startedAt, readCount: 1},
      unset: ['readingPeriod', 'readingHistory'],
    }
  }
  if (startedAt > progress.finishedAt) {
    throw new Error(`Date Added is after Date Read for ${progress.title || progress._id}.`)
  }

  const period = {_type: 'readingPeriod' as const, start: startedAt, end: progress.finishedAt}
  return {
    set: {
      startedAt,
      readCount: 1,
      readingPeriod: period,
      readingHistory: [{
        _key: `goodreads-${progress.finishedAt}`,
        _type: 'readingPeriodEntry',
        start: startedAt,
        end: progress.finishedAt,
      }],
    },
    unset: [],
  }
}

async function main() {
  config({path: ['.env.local', '.env'], quiet: true})
  const {readerId, dataset, apply} = argumentsFrom(process.argv.slice(2))
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const token = apply
    ? process.env.SANITY_API_WRITE_TOKEN
    : process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_WRITE_TOKEN
  if (!projectId || !token) throw new Error('Required Sanity configuration is missing.')

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2026-09-01',
    useCdn: false,
    token,
    perspective: 'raw',
  })
  const query = /* groq */ `*[
    _type == "readingProgress" &&
    !(_id in path("drafts.**")) &&
    reader._ref == $readerId &&
    importSource == "goodreads"
  ] | order(_id asc){
    _id, _rev, status, finishedAt, "title": book->title,
    "addedAt": *[
      _type == "shelfEntry" &&
      !(_id in path("drafts.**")) &&
      shelf->owner._ref == $readerId &&
      book._ref == ^.book._ref
    ] | order(_createdAt asc)[0].addedAt
  }`
  const progress = await client.fetch<Progress[]>(query, {readerId})
  const planned = progress
    .map((document) => ({document, change: replacement(document)}))
    .filter((item): item is {document: Progress; change: NonNullable<ReturnType<typeof replacement>>} =>
      item.change !== null)
  const skipped = progress.filter((document) => !document.addedAt)
  const summary = {
    projectId,
    dataset,
    readerId,
    found: progress.length,
    planned: planned.length,
    skippedWithoutDateAdded: skipped.length,
    completedWithDateRead: progress.filter((document) => document.status === 'finished' && document.finishedAt).length,
    completedWithoutDateRead: progress.filter((document) => document.status === 'finished' && !document.finishedAt).length,
    currentlyReading: progress.filter((document) => document.status === 'currentlyReading').length,
    wantToRead: progress.filter((document) => document.status === 'wantToRead').length,
  }
  console.log(JSON.stringify({phase: 'plan', apply, ...summary}))
  if (!apply) return

  const backupPath = `/tmp/everlogue-goodreads-dates-${readerId}-${Date.now()}.json`
  await writeFile(backupPath, JSON.stringify({summary, progress}, null, 2), {mode: 0o600})
  for (let offset = 0; offset < planned.length; offset += 50) {
    const transaction = client.transaction()
    for (const {document, change} of planned.slice(offset, offset + 50)) {
      transaction.patch(document._id, (patch) => {
        let next = patch.ifRevisionId(document._rev).set(change.set)
        if (change.unset.length) next = next.unset(change.unset)
        return next
      })
    }
    await transaction.commit({visibility: 'sync'})
  }

  const verified = await client.fetch<{
    total: number
    multipleHistory: number
    wrongReadCount: number
    datedWithoutSingleHistory: number
  }>(`{
    "total": count(*[_type == "readingProgress" && reader._ref == $readerId && importSource == "goodreads"]),
    "multipleHistory": count(*[_type == "readingProgress" && reader._ref == $readerId && importSource == "goodreads" && count(readingHistory) > 1]),
    "wrongReadCount": count(*[_type == "readingProgress" && reader._ref == $readerId && importSource == "goodreads" && ((status == "finished" && readCount != 1) || (status != "finished" && readCount != 0))]),
    "datedWithoutSingleHistory": count(*[_type == "readingProgress" && reader._ref == $readerId && importSource == "goodreads" && status == "finished" && defined(finishedAt) && count(readingHistory) != 1])
  }`, {readerId})
  if (verified.multipleHistory || verified.wrongReadCount || verified.datedWithoutSingleHistory) {
    throw new Error('Verification failed. Review the protected backup before making further changes.')
  }
  console.log(JSON.stringify({phase: 'verified', repaired: planned.length, skipped: skipped.length, verified, backupPath}))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Repair failed.')
  process.exitCode = 1
})
