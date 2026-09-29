# Performance notes

Do not claim Everlogue is faster than Goodreads. These are actual measurements.

## Method

Lighthouse mobile, Google Chrome, against local `pnpm dev` on 20 Sep 2026.

## 20 Sep 2026

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| `/` (Discover) | 78 | 95 | 96 | 100 |
| `/browse` | 99 | 91 | 96 | 100 |

`/books/[slug]` and `/my-books` were not measured in this pass.

Discover is slower than Browse in this run (likely cover images from Open Library on the homepage). No Goodreads comparison was made.
