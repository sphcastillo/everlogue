/** A competing profile creation committed, but its query result is not visible yet. */
export class ReaderProfilePendingError extends Error {}

function isTransient(error: unknown): boolean {
  if (error instanceof ReaderProfilePendingError) return true
  if (!error || typeof error !== 'object') return false
  const value = error as {statusCode?: number; status?: number; code?: string; cause?: unknown}
  const status = value.statusCode ?? value.status
  return status === 429 || (status !== undefined && status >= 500 && status <= 599) ||
    ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(value.code ?? '') ||
    (value.cause !== error && value.cause !== undefined && isTransient(value.cause))
}

/** Retry only idempotent reader setup, never permissions/configuration failures. */
export async function retryReaderSetup<T>(
  operation: () => Promise<T>,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  const delays = [200, 600]
  for (let attempt = 0; ; attempt++) {
    try { return await operation() }
    catch (error) {
      if (attempt >= delays.length || !isTransient(error)) throw error
      await wait(delays[attempt])
    }
  }
}
