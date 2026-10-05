import {BookClubDiscoveryShowcase} from './components/BookClubDiscoveryShowcase'
import {BookRatingsView} from './components/BookRatingsView'
import {bookClubWatchActions} from './actions/bookClubWatchActions'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'
import {editorialReviewActions} from './actions/editorialReviewActions'
import {goodreadsImportActions} from './actions/goodreadsImportActions'


const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

export default defineConfig({
  name: 'default',
  title: `Everlogue · ${dataset}`,

  projectId: '3h0o1unw',
  dataset,

  plugins: [
    structureTool({
      structure,
      defaultDocumentNode: (S, {schemaType}) => {
        if (schemaType === 'bookClubDiscovery') {
          return S.document().views([S.view.component(BookClubDiscoveryShowcase).title('Discovery')])
        }
        if (schemaType === 'book') {
          return S.document().views([
            S.view.form(),
            S.view.component(BookRatingsView).title('Ratings'),
          ])
        }
        return S.document().views([S.view.form()])
      },
    }),
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
    actions: (prev, context) => bookClubWatchActions(goodreadsImportActions(editorialReviewActions(prev, context), context), context),
  },
})
