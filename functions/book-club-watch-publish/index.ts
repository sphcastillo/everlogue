import {documentEventHandler} from '@sanity/functions'
import {watchClient} from '../../src/lib/book-club-watch/runtime'
import {publishDiscovery} from '../../src/lib/book-club-watch/publish'
export const handler = documentEventHandler<{_id: string}>(async ({context, event}) => {
  if (context.local || process.env.WATCH_ENABLED !== 'true') {
    console.log('Book Club Watch publication disabled; no mutations performed.')
    return
  }
  await publishDiscovery(watchClient(context.clientOptions.token), event.data._id)
})
