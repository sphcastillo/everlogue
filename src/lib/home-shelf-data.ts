/** Start public data immediately; only personalized data depends on the reader.
 * Promise.all attaches rejection handlers to both branches immediately.
 * This is request-local orchestration, not a cache of reader/library data.
 */
export async function loadHomeShelfData<R, P, B>(
  loadReader: () => Promise<R | null>,
  loadPublic: () => Promise<P>,
  loadPersonal: (reader: R) => Promise<B[]>,
) {
  const [picks, personal] = await Promise.all([
    loadPublic(),
    loadReader().then(async reader => ({reader, books: reader ? await loadPersonal(reader) : []})),
  ])
  return {picks, reader: personal.reader, books: personal.books}
}
