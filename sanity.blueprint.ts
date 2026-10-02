import {defineBlueprint, defineDocumentFunction, defineRobotToken, defineScheduledFunction} from '@sanity/blueprints'
import {CLUBS, TIMEZONE, type Club} from './src/lib/book-club-watch/model'

// Never default deployment to production. Export these values explicitly.
const project = process.env.WATCH_PROJECT_ID
const dataset = process.env.WATCH_DATASET
if (!project || !dataset) throw new Error('Set WATCH_PROJECT_ID and WATCH_DATASET before planning or deploying Watch.')
const enabled = process.env.WATCH_ENABLED === 'true'
if (dataset === 'production' && enabled && process.env.WATCH_PRODUCTION_VALIDATED !== 'true') {
  throw new Error('Validate Watch in an isolated dataset before setting WATCH_PRODUCTION_VALIDATED=true.')
}
const env = {WATCH_PROJECT_ID: project, WATCH_DATASET: dataset, WATCH_ENABLED: String(enabled)}
const robotToken = '$.resources.book-club-watch-robot.token'
export default defineBlueprint({
  resources: [
    defineRobotToken({name: 'book-club-watch-robot', label: 'Book Club Watch', memberships: [{resourceType: 'project', resourceId: project, roleNames: ['editor']}]}),
    ...Object.entries(CLUBS).map(([club, config]) => defineScheduledFunction({
      name: `book-club-watch-${club === 'read-with-jenna' ? 'jenna' : club}`,
      displayName: `Book Club Watch — ${CLUBS[club as Club].name}`,
      event: {expression: config.schedule}, timezone: TIMEZONE, robotToken,
      timeout: 180, memory: 1, env,
    })),
    defineDocumentFunction({name: 'book-club-watch-publish', displayName: 'Book Club Watch — publish approved discovery',
      project, robotToken, timeout: 180, memory: 1, env,
      event: {on: ['update'], resource: {type: 'dataset', id: `${project}.${dataset}`},
        filter: '_type == "bookClubDiscovery" && status == "approved" && !defined(catalogBook) && !(_id in path("drafts.**")) && (delta::changedAny(status) || delta::changedAny(retryRequestedAt))',
        projection: '{_id}',
      },
    }),
  ],
})
