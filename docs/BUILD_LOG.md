# Everlogue — dated build log

Contest entry period: 18 Sep 2026 09:00 PDT – 4 Oct 2026 23:59 PDT.  
This log is written as work happens. Nothing is backdated.

## 20 Sep 2026 — Stage 1 inspection

### Prompt in this session
Implement the attached Everlogue plan: Next.js at the repository root with `src/` and `studio/` as siblings, Clerk for auth, all application data in a private Sanity dataset, and the full Path Two product.

### Repository at start
The workspace was a default Sanity Studio scaffold (`sanity` / `@sanity/vision` 6.15, empty `schemaTypes`, project `3h0o1unw`, dataset `production`). No Next.js app, no catalog, no reader features.

### Git history vs entry period

```
75a537dfe730ece51a92daf83cd7a26db6c6e402 2026-09-20T22:32:51-04:00 feat: bootstrap sanity studio
```

That commit is **during** the Entry Period (after 18 Sep 2026 09:00 PDT). It is a default `sanity init` Studio, not a pre-built Goodreads competitor. Product work in this log is also 20 Sep 2026.

### Sanity MCP
Connected namespace `user-Sanity` reported ready. `mcp_auth` succeeded. Subsequent MCP calls (`whoami`, `list_projects`, `list_datasets`, `query_documents`, `search_docs`, `run_sanity_cli`, `update_dataset`, `add_cors_origin`) timed out. Schema stayed in local Studio (MCP `deploy_schema` not used). CLI was used instead for datasets, CORS, and tokens.

Project used: `3h0o1unw` only.

### Dataset privacy
`production` was **public**. Command:

`pnpm --dir studio exec sanity dataset visibility set production private`

Result: visibility changed to **private**. Note from CLI: assets remain public. Reader documents were imported only after this change.

CORS: added `http://localhost:3000` with credentials. Studio origin `http://localhost:3333` was already present.

### Provider evaluation (current public docs, 20 Sep 2026)
- **Open Library:** Chosen for a bounded offline import. User-Agent set. Covers displayed from `covers.openlibrary.org`, not re-hosted.
- **Google Books:** Rejected (required Google branding).
- **Hardcover:** Rejected as a live backend (offline/localhost-oriented; user-owned ratings not for public sites).

### Corrections from the approved plan
- Next.js at repo root; `src/` and `studio/` siblings.
- Clerk for auth; Sanity for catalog and reader data.
- No Auth.js / Prisma / Postgres.
- Server-side catalog fetch + revalidation instead of `defineLive` with a browser token (would have exposed reader documents in a private dataset).

### What failed
MCP timeouts. Icon skill recommended `@sanity/icons/Name` subpaths; installed `@sanity/icons@3.8.0` only exports the package root, so Studio crashed until imports were changed to `from '@sanity/icons'`. `src/sanity/image.ts` first imported `../env` (wrong); fixed to `./env` before `next build` succeeded.

---

## 20 Sep 2026 — Stages 2–4 implementation

### Architecture
Standalone Studio in `studio/`. Next.js App Router in `src/`. Private Sanity dataset for catalog **and** reader/community documents. Clerk session on the server derives the acting reader. Write token is server-only. Catalog queries never request reader types. Private queries use `useCdn: false` and `cache: 'no-store'`.

### Schema
Referenced documents: work, edition, author, genre, editorialCollection, bestsellerSource, celebrityClub, celebritySelection, editorialReview, siteSettings, readerProfile, rating, review, shelf, shelfEntry, readingProgress, communityClub, clubMembership, poll, vote, discussionThread, discussionPost. Objects: sourceProvenance, ratingStats. Custom Studio structure + workflow document actions (Send to review / Approve / Reject) with allowed transitions.

### Import
`scripts/import-catalog.ts` fetched Open Library search + work JSON for 16 titles. Duplicate handling by source keys; `editorialLocked` skipped. Result: **16 works imported, no skipped titles**. Bootstrap: Discover collection created as `proposed`, then transitioned to `approved` with `reviewedBy: import-catalog` and timestamp so Discover is not empty. Celebrity months approved **empty** with an honest empty reason (no invented picks). Demo club `Evermore Readers` labeled `isDemoClub`; demo thread/post labeled separately.

### UI
Arc-inspired warmth, original identity (Fraunces + Figtree, cream/ink/terracotta). Desktop sidebar, mobile bottom nav. Accessible half-star control is a radiogroup (0.5–5) plus Clear rating (unrated ≠ 0).

### Blocked
Clerk publishable/secret keys were not in the environment. Sign-in, persisted ratings, second-reader permission tests, club join/vote/post, and webhook signature tests are **implemented in code** and **not end-to-end verified**. Demo judge Clerk account cannot be issued until keys exist.

---

## 20 Sep 2026 — Stages 5–6 verification

### Local routes (HTTP 200)
`/`, `/browse`, `/bestsellers`, `/picks`, `/clubs`, `/collections/forever-fantasy`, `/books/a-wizard-of-earthsea`, `/releases/this-week`, `/browse/fantasy`, `/browse/fantasy/2019`, `/clubs/evermore-readers`, `/picks/reese`.

### Lighthouse (mobile, Chrome, localhost, 20 Sep 2026)
Do not compare to Goodreads.

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| `/` | 78 | 95 | 96 | 100 |
| `/browse` | 99 | 91 | 96 | 100 |

My Books / book-detail Lighthouse not recorded in this pass.

### Deploy
https://readevermore.vercel.app — homepage 200, shows Forever fantasy and imported works. Sanity env vars set on Vercel. Clerk env skipped (empty). Dataset remains private; judges get the project ID, not a public dataset query URL.

### App SDK
Deferred. Core editorial workflow is Studio document actions + server `transitionWorkflow`. That is not an App SDK app.

### Secrets
`.env.local` gitignored (`*.local`, `.env*`). `.vercel` gitignored. No tokens in docs, screenshots, or this log.

### DEV post
Draft only in `docs/SUBMISSION.md`. Not published.

---

## 21 Sep 2026 — Arc-inspired visual pass

Restyled the reader app toward a warm, minimal, tactile interface: peach/lilac canvas, floating rounded sidebar and main panel, color-dot navigation, pill controls, and cover hover that lifts slightly. Page headers, filters, and club actions now share the same surface language. Reduced-motion still disables those transforms. Identity stays original (Fraunces, Figtree, cream/ink) rather than Arc branding.

---
