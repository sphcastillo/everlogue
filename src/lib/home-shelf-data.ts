/** Start public data immediately; only personalized data depends on the reader.
 * Promise.all attaches rejection handlers to both branches immediately.
 * This is request-local orchestration, not a cache of reader/library data.
 */
export async function loadHomeShelfData<R, P, B>(
  loadReader: () => Promise<R | null>,
  loadPublic: () => Promise<P>,
  loadPersonal: (reader: R) => Promise<{books: B[]; hasLibrary: boolean}>,
) {
  const [picks, personal] = await Promise.all([
    loadPublic(),
    loadReader().then(async reader => {
      if (!reader) return {reader: null, books: [] as B[], hasLibrary: false}
      const loaded = await loadPersonal(reader)
      return {reader, books: loaded.books, hasLibrary: loaded.hasLibrary}
    }),
  ])
  return {picks, ...personal}
}
