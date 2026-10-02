import {BookClubDiscoveryShowcase} from './components/BookClubDiscoveryShowcase'
import {bookClubWatchActions} from './actions/bookClubWatchActions'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {editorialReviewActions} from './actions/editorialReviewActions'


const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

export default defineConfig({
  name: 'default',
  title: `Everlogue · ${dataset}`,

  projectId: '3h0o1unw',
  dataset,

  plugins: [
    structureTool({structure, defaultDocumentNode: (S, {schemaType}) => schemaType === 'bookClubDiscovery' ? S.document().views([S.view.component(BookClubDiscoveryShowcase).title('Discovery')]) : S.document().views([S.view.form()])}),
    visionTool(),
  ],

  studio: {
    components: {

    },
  },

  schema: {
    types: schemaTypes,
    templates: (prev) => prev.filter((t) => !['bookClubDiscovery', 'bookClubWatchRun'].includes(t.schemaType)),
  },

  document: {
    actions: (prev, context) => bookClubWatchActions(editorialReviewActions(prev, context), context),
  },
})
