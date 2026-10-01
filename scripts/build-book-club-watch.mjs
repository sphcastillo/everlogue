import {build} from 'esbuild'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const outdir = await mkdtemp(join(tmpdir(), 'book-club-watch-build-'))
await build({
  entryPoints: ['reese', 'gma', 'jenna', 'oprah', 'publish'].map((name) => `functions/book-club-watch-${name}/index.ts`),
  outdir, bundle: true, platform: 'node', format: 'cjs', target: 'node24', logLevel: 'info',
})
console.log(`All five Watch handlers bundled successfully: ${outdir}`)
