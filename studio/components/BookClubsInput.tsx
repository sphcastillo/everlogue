import {useCallback, useEffect, useRef, useState} from 'react'
import {set, unset, useClient, useFormValue, type ArrayOfObjectsInputProps} from 'sanity'

type ClubOption = {_id: string; title: string}
type ClubRef = {_key: string; _type: 'reference'; _ref: string}

function publishedId(id?: string | null) {
  return (id || '').replace(/^drafts\./, '')
}

function asRefs(value: ArrayOfObjectsInputProps['value']): ClubRef[] {
  return (value || []).flatMap((item) => {
    if (!item || typeof item !== 'object' || !('_ref' in item) || typeof item._ref !== 'string') return []
    return [
      {
        _key: typeof item._key === 'string' ? item._key : item._ref,
        _type: 'reference',
        _ref: item._ref,
      },
    ]
  })
}

export function BookClubsInput(props: ArrayOfObjectsInputProps) {
  const {value, onChange, readOnly} = props
  const client = useClient({apiVersion: '2026-02-01'})
  const documentId = publishedId(useFormValue(['_id']) as string | undefined)
  const [clubs, setClubs] = useState<ClubOption[]>([])
  const [ready, setReady] = useState(false)
  const seeded = useRef(false)
  const selected = new Set(asRefs(value).map((item) => item._ref))

  useEffect(() => {
    let cancelled = false
    client
      .fetch<ClubOption[]>(`*[_type == "curatedCollection"] | order(coalesce(sortOrder, 999) asc, title asc){_id, title}`)
      .then((docs) => {
        if (!cancelled) setClubs(docs || [])
      })
      .catch(() => {
        if (!cancelled) setClubs([])
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [client])

  useEffect(() => {
    if (seeded.current || !documentId || asRefs(value).length) {
      if (asRefs(value).length) seeded.current = true
      return
    }
    let cancelled = false
    client
      .fetch<string[]>(`*[_type == "curatedCollection" && references($bookId)]._id`, {bookId: documentId})
      .then((ids) => {
        if (cancelled || seeded.current || !ids?.length) {
          seeded.current = true
          return
        }
        seeded.current = true
        onChange(
          set(
            ids.map((id) => ({
              _key: id.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || crypto.randomUUID().slice(0, 12),
              _type: 'reference',
              _ref: id,
            })),
          ),
        )
      })
      .catch(() => {
        seeded.current = true
      })
    return () => {
      cancelled = true
    }
  }, [client, documentId, onChange, value])

  const syncCollection = useCallback(
    async (clubId: string, nextSelected: boolean) => {
      if (!documentId) return
      const collection = await client.fetch<{
        books?: {book?: {_ref?: string}; selectionNumber?: number}[]
      } | null>(`*[_id == $clubId][0]{books[]{book, selectionNumber}}`, {clubId})
      const books = collection?.books || []
      const already = books.some((entry) => entry.book?._ref === documentId)
      if (nextSelected && already) return
      if (!nextSelected && !already) return
      if (nextSelected) {
        const nextNumber = Math.max(0, ...books.map((entry) => entry.selectionNumber || 0)) + 1
        const entry = {
          _type: 'curatedCollectionEntry',
          _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
          book: {_type: 'reference', _ref: documentId},
          selectionNumber: nextNumber,
        }
        if (!books.length) {
          await client.patch(clubId).set({books: [entry]}).commit({visibility: 'async'})
        } else {
          await client.patch(clubId).insert('after', 'books[-1]', [entry]).commit({visibility: 'async'})
        }
        return
      }
      await client.patch(clubId).unset([`books[book._ref=="${documentId}"]`]).commit({visibility: 'async'})
    },
    [client, documentId],
  )

  function toggle(clubId: string) {
    if (readOnly) return
    const current = asRefs(value)
    const isSelected = selected.has(clubId)
    const next = isSelected
      ? current.filter((item) => item._ref !== clubId)
      : [
          ...current,
          {
            _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
            _type: 'reference' as const,
            _ref: clubId,
          },
        ]
    onChange(next.length ? set(next) : unset())
    void syncCollection(clubId, !isSelected)
  }

  if (!ready) return <p>Loading book clubs…</p>
  if (!clubs.length) return <p>No book club collections yet.</p>

  return (
    <div>
      <p style={{margin: '0 0 0.75rem', opacity: 0.7}}>A book can appear on more than one club list.</p>
      <div style={{display: 'grid', gap: '0.65rem'}}>
        {clubs.map((club) => (
          <label key={club._id} style={{display: 'flex', alignItems: 'center', gap: '0.6rem'}}>
            <input
              type="checkbox"
              checked={selected.has(club._id)}
              disabled={readOnly}
              onChange={() => toggle(club._id)}
            />
            <span>{club.title}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
