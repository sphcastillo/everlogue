# Everlogue — implementation checklist

Status: `implemented` | `verified` | `blocked` | `deferred`

## Stage 1 — inspect and restructure
- [x] Git history recorded against Entry Period — **verified** (`75a537d` 20 Sep 2026, during contest)
- [x] Sanity MCP identity / datasets / CORS checked (or blocker logged) — MCP **blocked** (timeouts); CLI used
- [x] Dataset privacy verified private before reader data — **verified** (was public → set private)
- [x] `studio/` package moved; Next.js at repo root with `src/` — **verified**
- [x] Dated build log started — **verified**

## Stage 2 — discovery-to-shelf
- [x] Catalog schemas — **implemented**
- [x] Reader schemas — **implemented**
- [x] Editorial schemas — **implemented**
- [x] Custom Studio structure — **implemented**
- [x] 8–20 verified Open Library works — **verified** (16 works)
- [x] Discover → collection page → book page — **verified** locally and on production
- [x] Half-star ratings 0.5–5; unrated separate from 0 — **implemented** (radiogroup + clear)
- [x] Want to Read / Currently Reading / Finished — **implemented**
- [x] Clerk session verified on server — **blocked** (no Clerk keys)
- [x] Ownership checks; private responses uncached — **implemented**, not cross-account verified
- [x] Persistence across refresh and re-login — **blocked** (no Clerk keys)
- [x] Second reader cannot modify the first — **blocked** (no Clerk keys)
- [x] Responsive layouts from the start — **implemented** (sidebar + bottom nav); not separately device-lab verified

## Stage 3 — browse, releases, picks
- [x] Browse + full genre/subgenre pages — **verified** (`/browse`, `/browse/fantasy`)
- [x] Search, sort, pagination, filters in URL — **implemented**
- [x] Release hubs — **verified** (`/releases/this-week` 200)
- [x] First publication vs reprint distinguished — **implemented**
- [x] Catalog coverage disclaimer — **verified** on homepage
- [x] Fantasy by year with documented rating method — **verified** (`/browse/fantasy/2019`; empty ranked list + editorial fallback)
- [x] Bestseller directory — **verified** (NYT, LAT weekly story URL, PW Circana; links only)
- [x] Celebrity clubs with empty unverified months — **verified** (no invented picks)

## Stage 4 — clubs and editorial workflow
- [x] One complete club UI: current read, poll, spoiler thread — **implemented**; join/vote/post **blocked** on Clerk
- [x] Membership permissions and basic moderation — **implemented** server-side
- [x] Demo activity labeled and separate — **implemented**
- [x] proposed → needsReview → approved | rejected — **implemented** (Studio actions + `src/lib/actions.ts`)
- [x] Approved content appears on Discover — **verified** (Forever fantasy)

## Stage 5 — verify
- [ ] Permissions across accounts — **blocked** (Clerk)
- [x] Keyboard / accessible rating control — **implemented** (radiogroup, aria-label); a11y Lighthouse 95/91
- [x] Measured performance — **verified** on `/` and `/browse` (see `docs/PERFORMANCE.md`)
- [x] App SDK review app — **deferred** (not built; do not describe Studio as App SDK)

## Stage 6 — deploy and submission draft
- [x] Deployed demo — **verified** https://readevermore.vercel.app
- [x] `docs/SUBMISSION.md` draft — **implemented**
- [x] Secrets audit — `.env.local` / `.vercel` gitignored; no secrets in markdown
- [x] DEV post **not** published without approval
