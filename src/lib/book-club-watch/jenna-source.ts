import * as cheerio from 'cheerio'

export type JennaPick = {selectionNumber: number; title: string; authors: string[]; selectionDate?: string; isbn?: string}
const clean = (value: string) => value.replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const key = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const months = 'January February March April May June July August September October November December'.split(' ')

export function parseJennaPicks(html: string): JennaPick[] {
  const $ = cheerio.load(html)
  const picks = new Map<string, Omit<JennaPick, 'selectionNumber'>>()
  let selectionDate: string | undefined
  // Read each product heading once. Container text includes prices and retailers.
  $('h1,h2,h3,h4,h5,h6').each((_, element) => {
    const heading = $(element)
    const text = clean(heading.text())
    const date = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s*(20\d{2})$/i)
    if (date) { selectionDate = `${months.find((month) => month.toLowerCase() === date[1].toLowerCase())} ${date[2]}`; return }
    if (!heading.is('[data-testid="product-title"]') || !selectionDate) return
    const card = heading.closest('[data-testid="article-product-unit"]')
    const withAuthor = text.match(/^(.*?)\s+by\s+(.+)$/i)
    const title = clean(withAuthor?.[1] || text).replace(/^[“"']|[”"']$/g, '').replace(/[,\s]+$/, '').replace(/:\s*a novel$/i, '')
    let author = withAuthor?.[2]
    if (!author) {
      card.find('img[alt]').each((_, image) => {
        const match = clean($(image).attr('alt') || '').match(/^(.*?)\s+by\s+(.+)$/i)
        if (match && key(match[1]) === key(title)) author ||= match[2]
      })
    }
    let isbn: string | undefined
    card.find('a[href]').each((_, anchor) => {
      try {
        let url = new URL($(anchor).attr('href')!)
        const destination = url.searchParams.get('d')
        if (destination) url = new URL(destination)
        const candidate = url.searchParams.get('ean') || (url.hostname === 'bookshop.org' ? url.pathname.match(/\/(\d{13})\/?$/)?.[1] : undefined) || url.pathname.match(/\/(?:dp|product|ASIN)\/(\d{9}[\dX]|\d{13})(?:\/|$)/i)?.[1]
        if (candidate && /^(?:\d{9}[\dX]|\d{13})$/.test(candidate)) isbn ||= candidate
        // Bookshop's explicit title-author slug supplies names omitted by some headings.
        if (!author && url.hostname === 'bookshop.org') {
          const slug = url.pathname.match(/\/books\/([^/]+)\//)?.[1]
          const titleSlug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          if (slug?.startsWith(`${titleSlug}-`)) {
            const name = slug.slice(titleSlug.length + 1).replace(/-/g, ' ')
            if (/^[a-z]+(?: [a-z]+){1,4}$/.test(name)) author = name
          }
        }
      } catch { /* Ignore malformed or relative shopping URLs. */ }
    })
    const authors = author ? clean(author).split(/\s+(?:and|&)\s+/i) : []
    // TODAY's product heading misspells Emma Straub for this specific selection.
    if (key(title) === 'alladultshere' && authors.length === 1 && key(authors[0]) === 'emmastaub') authors[0] = 'Emma Straub'
    if (authors.some((name) => /\$|\d|%/.test(name))) throw new Error(`Shopping text found in author for ${title}`)
    const identity = `${selectionDate}:${key(title)}`
    const existing = picks.get(identity)
    if (!existing) picks.set(identity, {title, authors, selectionDate, isbn})
    else {
      if (!existing.authors.length) existing.authors = authors
      existing.isbn ||= isbn
    }
  })
  return [...picks.values()].reverse().map((pick, index) => ({...pick, selectionNumber: index + 1}))
}
