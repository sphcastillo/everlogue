import {slugify} from './validation'

/** Same result as Studio Generate on an author name: Stacy Willingham → stacy-willingham. */
export function authorSlug(name: string) {
  const fromGenerate = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 96)
  return fromGenerate || slugify(name) || 'author'
}

export function uniqueAuthorSlug(name: string, taken: Iterable<string>) {
  const used = taken instanceof Set ? taken : new Set(taken)
  const base = authorSlug(name)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
