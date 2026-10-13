import 'server-only'
import {z, ZodError} from 'zod'
import {getOptionalReader, privateHeaders, type ReaderSession} from './reader'
import {ReaderDataError} from './reader-data-error'
import {ratingValueSchema, readingStatusSchema, shelfBookSchema} from './validation'

// Strict objects reject identity/document overrides rather than silently ignoring them.
export const shelfStatusRequest = z.object({
  book: z.discriminatedUnion('source', [
    shelfBookSchema.options[0].strict(),
    shelfBookSchema.options[1].strict(),
  ]),
  status: readingStatusSchema.nullable(),
}).strict()

export const ratingRequest = z.object({
  bookId: z.string().trim().min(1),
  value: ratingValueSchema.nullable(),
}).strict()

class RequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message)
  }
}

const MAX_BODY_BYTES = 8192

export async function readReaderJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError('Send application/json.', 415, 'unsupported_media_type')
  }
  const stream = request.body?.getReader()
  if (!stream) throw new RequestError('Send a JSON object.', 400, 'invalid_request')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const {done, value} = await stream.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await stream.cancel()
        throw new RequestError('Request body exceeds 8 KiB.', 413, 'request_too_large')
      }
      chunks.push(value)
    }
  } finally {
    stream.releaseLock()
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RequestError('Send valid JSON.', 400, 'invalid_request')
  }
}

/** Authenticate before reading input; all handlers delegate to authenticated web services. */
export async function readerApi(
  request: Request,
  operation: (reader: ReaderSession) => Promise<unknown>,
) {
  const headers = privateHeaders()
  try {
    const reader = await getOptionalReader()
    if (!reader) throw new RequestError('Sign in to continue.', 401, 'unauthenticated')
    if (new URL(request.url).search) {
      throw new RequestError('Query parameters are not supported.', 400, 'invalid_request')
    }
    if (request.method !== 'GET') {
      const origin = request.headers.get('origin')
      // Native requests normally have no Origin. Browser cookie mutations must be same-origin.
      if (origin && origin !== new URL(request.url).origin) {
        throw new RequestError('Invalid origin.', 403, 'forbidden_origin')
      }
    }
    return Response.json(await operation(reader), {headers})
  } catch (error) {
    if (error instanceof RequestError || error instanceof ReaderDataError) {
      return Response.json({error: error.message, code: error.code}, {status: error.status, headers})
    }
    if (error instanceof ZodError) {
      return Response.json({error: 'Invalid request fields.', code: 'invalid_request'}, {status: 400, headers})
    }
    // Do not expose provider errors, credential-bearing URLs, or private data.
    return Response.json({error: 'Reader service unavailable. Please try again.', code: 'service_unavailable'}, {
      status: 503, headers,
    })
  }
}
