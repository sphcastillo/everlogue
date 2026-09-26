/** Dry run: node --import tsx scripts/migrate-books.ts; apply with --apply. */
import {config} from 'dotenv'
import {createClient} from '@sanity/client'
import {mkdtemp, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {planBookMigration, verifyBookMigration, type MigrationDocument} from './lib/book-migration'

async function main() {
  config({path: ['.env.local', '.env'], quiet: true})
  const flags = process.argv.slice(2)
  if (flags.some((flag) => flag !== '--apply')) throw new Error('Use --apply to run the reviewed migration.')
  const apply = flags.includes('--apply')
  const token = apply ? process.env.SANITY_API_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN
  if (!token) throw new Error('The required Sanity token is not configured.')
  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2026-09-01', useCdn: false, perspective: 'raw', token,
  })
  const load = () => client.fetch<MigrationDocument[]>('*[]')
  const before = await load()
  const plan = planBookMigration(before)
  const directory = await mkdtemp(join(tmpdir(), 'everlogue-book-migration-'))
  // The backup includes private reader data. Keep it outside the repository and
  // readable only by this OS account; never log document contents or credentials.
  await writeFile(join(directory, 'before.json'), JSON.stringify(before), {mode: 0o600})
  await writeFile(join(directory, 'plan.json'), JSON.stringify(plan, null, 2), {mode: 0o600})
  console.log(JSON.stringify({mode: apply ? 'apply' : 'dry-run', ...plan.summary, backupDirectory: directory}))
  if (!apply || !(plan.creates.length + plan.patches.length + plan.deletes.length)) return
  const tx = client.transaction()
  for (const doc of plan.creates) tx.create(doc)
  for (const patch of plan.patches) {
    tx.patch(patch.id, (builder) => {
      let next = builder.ifRevisionId(patch.revision)
      if (Object.keys(patch.set).length) next = next.set(patch.set)
      if (patch.unset.length) next = next.unset(patch.unset)
      return next
    })
  }
  for (const doc of plan.deletes) {
    // A revision guard in the same transaction protects against concurrent edits
    // between the backup and the deletion of the copied legacy document.
    tx.patch(doc.id, (patch) => patch.ifRevisionId(doc.revision).set({legacyBookMigration: true}))
    tx.delete(doc.id)
  }
  if (Buffer.byteLength(JSON.stringify(tx.serialize())) > 3_500_000) throw new Error('Migration is too large for one atomic transaction; review batching before applying.')
  await tx.commit({visibility: 'sync'})
  const after = await load()
  verifyBookMigration(plan, after)
  const verification = {
    verifiedAt: new Date().toISOString(), ...plan.summary,
    remainingWorks: after.filter((doc) => doc._type === 'work').length,
    ratingsPreserved: before.filter((doc) => doc._type === 'rating').length,
    readingProgressPreserved: before.filter((doc) => doc._type === 'readingProgress').length,
    shelfEntriesPreserved: before.filter((doc) => doc._type === 'shelfEntry').length,
  }
  await writeFile(join(directory, 'verification.json'), JSON.stringify(verification, null, 2), {mode: 0o600})
  console.log(JSON.stringify({phase: 'verified', ...verification, backupDirectory: directory}))
}

// Sanity request errors can contain authorization headers. Do not dump them.
main().catch(() => {
  console.error('Book migration stopped. Inspect the local backup and plan; request details are omitted to protect credentials.')
  process.exitCode = 1
})
