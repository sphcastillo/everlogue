import {createClient} from 'next-sanity'
import {apiVersion, dataset, projectId} from './env'

function readToken() {
  return process.env.SANITY_API_READ_TOKEN
}

function writeToken() {
  return process.env.SANITY_API_WRITE_TOKEN
}

/** Catalog reads. Token stays server-side. Dataset is private. */
export const catalogClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: readToken(),
  perspective: 'published',
})

/** Reader data. No CDN. Never import this into a client component. */
export const privateClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: readToken(),
  perspective: 'published',
})

export function writeClient() {
  const token = writeToken()
  if (!token) {
    throw new Error('SANITY_API_WRITE_TOKEN is required for reader updates.')
  }
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token,
    perspective: 'raw',
  })
}

export const noStore = {cache: 'no-store', next: {revalidate: 0}} as const
export const catalogRevalidate = {cache: 'no-store', next: {revalidate: 0, tags: ['catalog']}} as const
