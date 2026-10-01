/** Read-only source preview. Never instantiates a Sanity write client. */
import {parseArgs} from 'node:util'
import {CLUBS, easternDate, inWindow, type Club} from '../src/lib/book-club-watch/model'
import {discoverPicks} from '../src/lib/book-club-watch/sources'
const {values} = parseArgs({options: {club: {type: 'string'}, date: {type: 'string'}, 'ignore-window': {type: 'boolean'}, 'dry-run': {type: 'boolean'}}})
async function main() {
  if (!values.club || !(values.club in CLUBS)) throw new Error(`Use --club ${Object.keys(CLUBS).join('|')}`)
  const club = values.club as Club
  const now = values.date ? new Date(values.date.length === 10 ? `${values.date}T16:00:00Z` : values.date) : new Date()
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid --date; use YYYY-MM-DD or an ISO timestamp.')
  const eligible = inWindow(club, now)
  const picks = eligible || values['ignore-window'] ? await discoverPicks(club, easternDate(now).month) : []
  console.log(JSON.stringify({dryRun: true, club, easternDate: easternDate(now), eligible, picks}, null, 2))
}
main().catch((error) => {console.error(error.message); process.exitCode = 1})
