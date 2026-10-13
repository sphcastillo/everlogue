/** Expected reader rule failures; messages remain compatible with web actions. */
export class ReaderDataError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409, readonly code: string) {
    super(message)
    this.name = 'ReaderDataError'
  }
}
