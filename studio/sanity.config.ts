import {bookClubWatchActions} from './actions/bookClubWatchActions'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {editorialReviewActions} from './actions/editorialReviewActions'

export default defineConfig({
  name: 'default',
  title: 'Everlogue',

  projectId: '3h0o1unw',
  dataset: 'production',

  plugins: [
    structureTool({structure}),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    templates: (prev) => prev.filter((t) => !['bookClubDiscovery', 'bookClubWatchRun'].includes(t.schemaType)),
  },

  document: {
    actions: (prev, context) => bookClubWatchActions(editorialReviewActions(prev, context), context),
  },
})
