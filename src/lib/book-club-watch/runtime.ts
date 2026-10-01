import {createClient} from '@sanity/client'
import {scheduledEventHandler} from '@sanity/functions'
import {runWatch} from './service'
import {discoverPicks} from './sources'
import {easternDate, type Club} from './model'

export function watchClient(token?: string) {
  const projectId = process.env.WATCH_PROJECT_ID, dataset = process.env.WATCH_DATASET
  if (!projectId || !dataset || !token) throw new Error('Watch requires an explicit project, dataset, and robot token.')
  return createClient({projectId, dataset, token, apiVersion: '2026-09-01', useCdn: false, perspective: 'raw'})
}
export function scheduledWatch(club: Club) {
  return scheduledEventHandler(async ({context}) => {
    if (context.local) {
      console.log(JSON.stringify(await discoverPicks(club, easternDate(new Date()).month)))
      return
    }
    const result = await runWatch(watchClient(context.clientOptions?.token), club, {enabled: process.env.WATCH_ENABLED === 'true'})
    console.log(JSON.stringify({club, ...result}))
    if (result.outcome === 'failed') throw new Error(result.reason)
  })
}
