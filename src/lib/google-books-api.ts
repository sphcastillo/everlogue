import 'server-only'
import type {GoogleBook, GoogleSearchResponse} from './google-books'
import {normalizeIsbn} from './isbn'
import {GOOGLE_VOLUME_ID} from './google-books'

function apiKey() {
  const key = process.env.GOOGLE_BOOKS_API_KEY
  if (!key) throw new Error('Book search is not configured.')
  return key
}

const RETRYABLE_STATUSES = new Set([502, 503, 504])
const RETRY_DELAYS_MS = [250, 750]

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function googleFetch(path: string) {
  const url = `https://www.googleapis.com/books/v1/${path}`
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {'x-goog-api-key': apiKey()},
        cache: 'no-store',
      })
      if (!RETRYABLE_STATUSES.has(response.status) || attempt >= RETRY_DELAYS_MS.length) {
        return response
      }
      await response.body?.cancel()
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) throw error
    }
    await wait(RETRY_DELAYS_MS[attempt])
  }
}

export async function searchGoogleBooks(query: string) {
  const isbn = normalizeIsbn(query.replace(/^isbn:\s*/i, ''))
  const response = await googleFetch(`volumes?q=${encodeURIComponent(isbn ? `isbn:${isbn}` : query)}&maxResults=20`)
  if (!response.ok) {
    const error = new Error('Google Books request failed')
    ;(error as Error & {status: number}).status = response.status
    throw error
  }
  return (await response.json()) as GoogleSearchResponse
}

export async function fetchGoogleVolume(id: string) {
  if (!GOOGLE_VOLUME_ID.test(id)) return null
  const response = await googleFetch(`volumes/${encodeURIComponent(id)}`)
  if (response.status === 404) return null
  if (!response.ok) {
    const error = new Error('Google Books request failed')
    ;(error as Error & {status: number}).status = response.status
    throw error
  }
  const data = (await response.json()) as GoogleBook
  return data.id ? data : null
}
