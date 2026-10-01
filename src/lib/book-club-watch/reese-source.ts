import * as cheerio from 'cheerio'
export function parseReeseSourcePage(html: string, baseUrl: string) {
  const $ = cheerio.load(html)
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
  const picks: {title: string; authors: string[]; selectionDate?: string; sourceUrl: string}[] = []
  $('li.wp-block-post').each((_, el) => {
    const card = $(el), link = card.find('.wp-block-post-title a').first()
    const title = clean(link.text() || card.find('.wp-block-post-title').first().text()), href = link.attr('href')
    if (!title || !href) return
    const author = clean(card.find('.book-meta-author-row .value').first().text())
    picks.push({title, authors: author ? author.split(/\s+(?:and|&)\s+/i) : [],
      selectionDate: clean(card.find('.wp-block-post-date time').first().text()) || undefined,
      sourceUrl: new URL(href, baseUrl).href})
  })
  return {picks, next: $('a.wp-block-query-pagination-next').attr('href')}
}
