import {
  bookTitle,
  coverSrc,
  formatMoney,
  plainText,
  type GoogleBook,
} from '@/lib/google-books'
import {LogSelectedBook} from './LogSelectedBook'
import {BookCover} from './BookCover'

function Fact({label, value}: {label: string; value?: string | number | boolean | null}) {
  if (value == null || value === '') return null
  return (
    <div className="surface px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</p>
    </div>
  )
}

export function SearchBookDetail({book}: {book: GoogleBook}) {
  const info = book.volumeInfo
  const title = bookTitle(book)
  const cover = coverSrc(book)
  const authors = info?.authors?.join(', ')
  const description = plainText(info?.description)
  const snippet = plainText(book.searchInfo?.textSnippet)
  const identifiers = info?.industryIdentifiers || []
  const retail = formatMoney(book.saleInfo?.retailPrice)
  const list = formatMoney(book.saleInfo?.listPrice)
  const googleLink = info?.canonicalVolumeLink || info?.infoLink || info?.previewLink

  return (
    <article className="grid gap-10 lg:grid-cols-[240px_1fr]">
      <LogSelectedBook book={book} source="landing page" />
      <div className="group max-w-[240px]">
        <BookCover cover={{coverUrl: cover, isbn13: identifiers.find((id) => id.type === 'ISBN_13')?.identifier, isbn10: identifiers.find((id) => id.type === 'ISBN_10')?.identifier}} title={title} className="aspect-[2/3] w-full" />
      </div>
      <div>
        <p className="text-sm text-[var(--muted)]">{authors || 'Author unknown'}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[2.7rem] leading-[1.05] tracking-[-0.03em] sm:text-5xl">
          {title}
        </h1>
        {info?.subtitle ? <p className="mt-3 text-xl text-[var(--muted)]">{info.subtitle}</p> : null}
        <p className="mt-3 text-[var(--muted)]">
          {[info?.publisher, info?.publishedDate].filter(Boolean).join(' · ') || 'Publication details unknown'}
        </p>
        {info?.categories?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {info.categories.map((category) => (
              <span key={category} className="pill px-3 py-1 text-sm">
                {category}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-6 max-w-2xl whitespace-pre-wrap leading-7">
          {description || snippet || 'No description is available from Google Books for this edition.'}
        </p>
        {info?.averageRating != null ? (
          <p className="mt-4 text-sm">
            Google Books rating {info.averageRating}
            {info.ratingsCount ? ` from ${info.ratingsCount.toLocaleString('en-US')} ratings` : ''}. This is not a
            Everlogue score.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">No Google Books rating on this record.</p>
        )}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Fact label="Pages" value={info?.pageCount} />
          <Fact label="Printed pages" value={info?.printedPageCount} />
          <Fact label="Print type" value={info?.printType} />
          <Fact label="Language" value={info?.language} />
          <Fact label="Maturity" value={info?.maturityRating} />
          <Fact label="Google volume ID" value={book.id} />
          {identifiers.map((item) => (
            <Fact key={`${item.type}-${item.identifier}`} label={item.type || 'Identifier'} value={item.identifier} />
          ))}
          <Fact label="Saleability" value={book.saleInfo?.saleability} />
          <Fact label="Ebook" value={book.saleInfo?.isEbook} />
          <Fact label="List price" value={list} />
          <Fact label="Retail price" value={retail} />
          <Fact label="Viewability" value={book.accessInfo?.viewability} />
          <Fact label="Public domain" value={book.accessInfo?.publicDomain} />
          <Fact label="EPUB available" value={book.accessInfo?.epub?.isAvailable} />
          <Fact label="PDF available" value={book.accessInfo?.pdf?.isAvailable} />
          <Fact label="Access" value={book.accessInfo?.accessViewStatus} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {info?.previewLink ? (
            <a href={info.previewLink} target="_blank" rel="noopener noreferrer" className="pill is-active px-4 py-2 text-sm">
              Preview on Google Books ↗
            </a>
          ) : null}
          {googleLink ? (
            <a href={googleLink} target="_blank" rel="noopener noreferrer" className="pill px-4 py-2 text-sm">
              Google Books record ↗
            </a>
          ) : null}
          {book.saleInfo?.buyLink ? (
            <a href={book.saleInfo.buyLink} target="_blank" rel="noopener noreferrer" className="pill px-4 py-2 text-sm">
              Buy ↗
            </a>
          ) : null}
          {book.accessInfo?.webReaderLink ? (
            <a
              href={book.accessInfo.webReaderLink}
              target="_blank"
              rel="noopener noreferrer"
              className="pill px-4 py-2 text-sm"
            >
              Web reader ↗
            </a>
          ) : null}
        </div>
        <details className="surface mt-10 px-5 py-4">
          <summary className="cursor-pointer text-sm font-medium">Full Google Books response</summary>
          <pre className="mt-4 overflow-auto text-xs leading-6 text-[var(--muted)]">
            {JSON.stringify(book, null, 2)}
          </pre>
        </details>
      </div>
    </article>
  )
}
