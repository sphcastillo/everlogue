import {defineConfig} from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ['src/sanity/types.ts'],
    // Sanity TypeGen emits an empty interface extending its global query registry.
    rules: {'@typescript-eslint/no-empty-object-type': 'off'},
  },
])

export default eslintConfig
