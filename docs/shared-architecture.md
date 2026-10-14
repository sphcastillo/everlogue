# Everlogue shared architecture

Updated on 2026-10-13 for the shared reader API implementation. This is the canonical architecture record for web and mobile. The web endpoints below are implemented locally, not deployed by this task. Source/configuration findings and automated fixture tests are not claims of passed live simulator tests.

## Current implementation

### Projects and ownership

- Web: `/Users/sphcastillo/devPlayground/everlogue`, Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Clerk (`@clerk/nextjs`). UI and routes live in `src/app`; shared server logic is in `src/lib`.
- Mobile: `/Users/sphcastillo/devPlayground/everlogue-app`, Expo 57, React Native 0.86, Expo Router, TypeScript, NativeWind, Clerk (`@clerk/expo`). Read-only context for this task. Mobile owns native UI, API consumption, and client state.
- Web owns the standalone Sanity Studio 6 in `studio/`: `sanity.config.ts`, `schemaTypes/`, `structure/`, `components/`, and `actions/`. Studio editors access Sanity directly using Studio authentication; this is distinct from reader-client authorization.
- Existing related documentation: [editions](editions.md), [home shelves](home-shelves-api.md), [reading companion](reading-companion.md), [companion usage](Companion-Usage.md), and [README](../README.md). `CLAUDE.md` delegates to root `AGENTS.md`.

### Authoritative data model

Source schemas are registered in `studio/schemaTypes/index.ts`. The files below are under `studio/schemaTypes/documents/`; `studio/schema.json` and `src/sanity/types.ts` are generated artifacts, not schema authorities.

| Domain | Authority and relationships |
| --- | --- |
| Catalog work | `book.ts`: title, authors (strings), optional author references, genres, series, provider/source identities, covers, aggregate `ratingStats`. `author.ts`, `genre.ts`, `bookSeries.ts` define related catalog entities. Editorial/curated collections and celebrity club/selection schemas organize discovery. |
| Edition | `edition.ts`: references a book; ISBNs, provider IDs, publication metadata, format, language, translators, covers. Shared field `../fields/selectedEdition.ts` is used on shelf entries and progress. |
| Reader | `readerProfile.ts`: required `clerkUserId`, display name, synced email, avatar, profile visibility, preferences. |
| Shelves | `shelf.ts`: required owner reference to reader, name, slug, kind; visibility defaults private. `shelfEntry.ts`: shelf and book references, optional edition, required `addedAt`. Ownership is obtained through the shelf. |
| Reading state | `readingProgress.ts`: reader and book references, status, optional edition, percent, dates, read count, import source. |
| Ratings/reviews | `rating.ts`: reader/book references and half-star value. `review.ts`: reader/book references, title/body, spoilers, visibility and moderation. |
| Companion | `companionConversation.ts` and `companionUsage.ts`: reader history and usage; server also maintains internal identity/quota guards. |

Studio validation does not itself enforce reader ownership for API callers. The internal `clerkIdentity` uniqueness guard is created by `src/lib/reader-profile.ts`; it is not a registered Studio reader-profile schema.

### Authentication and reader identity

`src/proxy.ts` installs Clerk middleware/context; it does not globally require sign-in. Each resource must enforce its own authorization. `src/lib/reader.ts` calls Clerk `auth()`, verifies authenticated user ID, and resolves the reader by `clerkUserId`, never a client-supplied reader ID or email. `requireReader()` throws `Sign in to continue.` when unauthenticated.

`src/lib/reader-profile.ts` selects the oldest non-draft matching profile. If missing, it creates a generated profile ID and a `clerkIdentity.<Clerk user ID>` guard in one transaction, retries creation conflicts, and creates/repairs private system shelves. Existing duplicates are selected, not automatically merged. Clerk identity fields are synced while preserving reader preferences and library data. Signed-in visits can provision profiles without a webhook. The verified Clerk webhook also syncs create/update events and has a related-document deletion flow for deleted users; deletion completeness has not been live-tested.

Web uses Clerk sessions; shared routes accept mobile Clerk Bearer session tokens through the same middleware. Automated tests exercise the actual repository proxy and installed Clerk signature verifier with ephemeral RSA keys in production and development modes; native Bearer tokens and web cookies are accepted, invalid/expired/future/pending sessions are rejected. Mobile `src/lib/everlogue-api.ts` calls `getToken()` and attaches `Authorization: Bearer …` to the configured web origin. A real token from the configured Clerk instance and a simulator-to-running-server request remain unverified. The tests do not mint live sessions or use account credentials.

### Reader operations and verified rules

`src/lib/server-actions.ts` exposes Next.js server actions, backed by authenticated functions in `src/lib/actions.ts` and reusable mutation logic in `src/lib/library-book.ts`. These server actions remain in use by web. The new `/api/reader/*` handlers call those same authenticated functions: both transports use `setShelfStatus`, `setRating`, `getMyBooks`, and `getReaderProfileShowcase`. Server reads such as `getMyBooks`, `getReaderBookState`, and `getReaderProfileShowcase` scope queries to the authenticated reader and use no-store reads.

- System status/kind values are `wantToRead`, `currentlyReading`, `finished`; their labels are Want to Read, Currently Reading, Read. `custom` exists in the shelf schema but is not accepted as a reading status. System shelf IDs use `stableId(['shelf', readerId, kind])`; clients should consume returned IDs rather than construct them.
- `saveBookStatus` validates the catalog book and status. Moving status removes entries on other system shelves and preserves the selected edition. Repeating a placement reuses one target entry and collapses duplicate system entries/progress for that reader/book. Clearing status (`null`) removes system entries and reading progress; it does not delete ratings/reviews or custom-shelf entries. Dates are set if missing. Read status may include a `readingPeriod` with optional `start` and required `end`; each non-future value preserves year (`YYYY`), month (`YYYY-MM`), or exact-day (`YYYY-MM-DD`) precision. `appendRead: true` appends another occurrence to `readingHistory` while retaining one shelf entry and one progress document. Existing exact `startedAt`/`finishedAt` values remain compatible fallbacks. Web Read shelves sort by the latest period end with the shelf-added date as fallback.
- Goodreads CSV imports preserve `Date Added` as `shelfEntry.addedAt`. For Currently Reading and Read rows it also becomes `readingProgress.startedAt`; `Date Read` becomes `finishedAt`. When Date Read is present, the pair is stored as the first precision-preserving `readingPeriod`/`readingHistory` occurrence. A Date Added after Date Read is rejected rather than creating an inverted range.
- `saveBookRating` accepts 0.5–5 in 0.5 increments. `null` removes the found rating; zero is not an unrated stored value. A non-null rating requires Currently Reading or Read. It finds existing ratings by reader/book relationship, preserving migrated IDs, or uses a deterministic ID for a new rating. It recomputes the book's aggregate after mutation. This is not a general duplicate cleanup or proven concurrent aggregate consistency guarantee.
- Reviews require Read status, title 1–120 characters, body 1–8000, and private/public visibility (`src/lib/validation.ts`).
- A book is the shared work identity for shelves, ratings and reviews. An edition is a particular ISBN/copy, not a separate rated work. ISBN validation checks checksum and equivalent ISBN-10/13 duplicates; unchanged reprints reuse the edition. Imports use an ISBN guard. Selection validates that the edition belongs to the book, requires reading progress, and updates owned entries/progress together without changing work identity. See [editions](editions.md).
- Google Books additions resolve/import a catalog book through `setSearchReadingStatus`, `search-book.ts`, and edition helpers before reader placement. Provider IDs, catalog book IDs, slugs, and edition IDs must not be treated as interchangeable.
- Web actions invalidate relevant Next.js paths after changes. They usually return no payload and throw on validation/authentication errors; edition actions return `{ok: true}` or `{error}`, and lookup returns `{editionId, editions}` or `{error}`. The new reader endpoints add the JSON contract below without changing the existing web action return formats. Expected catalog/status failures carry typed HTTP status/code metadata while retaining the web error messages.

### HTTP endpoints currently present

Route implementations live at `src/app/api/<path>/route.ts`. Handled JSON failures generally use `{error: string}`, but there is no universal error layer; some authentication, malformed-body, and upstream exceptions escape route-local catches.

| Method and path | Request/authentication | Success / handled errors |
| --- | --- | --- |
| `GET /api/home/shelves` | Anonymous, no body | `{tabs: [{id, label, books}]}`; 503 on load failure. HTTP no-store; server catalog cache 120 seconds. |
| `GET /api/home/for-you` | Authenticated reader | `{hasLibrary, tabs}`; 401 guest, 503 load failure; private/no-store. No library gives `false, []`. |
| `GET /api/books/search?q=…` | Clerk auth; trimmed query 2–200 chars | Google Books search response (`items`, `totalItems` when supplied); 401, 400, 503 missing configuration, 502 or provider error status. |
| `GET /api/books/[id]` | Clerk auth; **Google volume ID**, matching provider-ID regex | Google volume object; 401, 404 invalid/missing volume, 502 or provider error status. This is not a catalog-book detail endpoint. |
| `GET /api/books/[id]/editions` | Catalog ID/slug resolver; anonymous catalog list with optional authenticated reader state | `{bookId, editions, selectedId, canSelect}`; 404 missing book. No explicit private cache headers despite personalized fields. |
| `POST /api/books/[id]/editions` | Authenticated reader with reading status; JSON `{isbn: string}` OR `{editionId: string|null}` | `{bookId, editionId, editions, selectedId, canSelect}`. ISBN lookup does not select the result. 400 malformed/invalid input, 401 guest, 404 book missing, 409 shelf/work conflict, 422 unverifiable work. Some errors before the mutation catch remain unnormalized. |
| `GET /api/library/export` | Authenticated reader | UTF-8 CSV attachment `everlogue-library.csv` (BOM), system shelves, selected-edition ISBNs, dates and ratings; 401 or 500 JSON error; private/no-store. |
| `POST /api/library/covers/[bookId]` | Authenticated reader, no body; rejects a supplied foreign Origin | `{cover: object|null}`; queries only owned shelf placement, returns null when unavailable/not owned. 403 Origin, 401 guest, 503 lookup failure; private/no-store. May import edition metadata. |
| `POST /api/companion` | JSON `{message, history?}`; guests allowed, personal context only for authenticated reader | NDJSON events `{type:"text", text}`, `{type:"retrieval", tool}`, `{type:"done"}`, or streamed `{type:"error", error}`. Message 1–2000 chars, history max 12 messages with role/text (max 8000 chars each), request max 32 KB. JSON errors: 400 input, 429 quota with Retry-After, 503 configuration/account/storage, 502 connection. |
| `GET/PUT/DELETE/PATCH /api/companion/history` | Authenticated reader. PUT `{messages}` max 40, user/assistant role, nonblank text max 8000, optional valid `createdAt`; PATCH `{recommendationKey}` max 300, restricted characters | GET `{messages}`; mutations `{ok:true}`; DELETE clears history, PATCH hides a recommendation. 401, 400 validation, 500 storage/unhandled parsing; private/no-store. |
| `POST /api/webhooks/clerk` | Clerk webhook body + verified signature, server signing secret | `{ok:true}`; 503 unconfigured, 400 signature, 500 synchronization. Not a reader-client endpoint. |

Home book projections include `_id`, title, slug, authors, ratingStats, pageCount, genres, and cover. See `src/lib/home-shelves.ts` and [home shelves](home-shelves-api.md) for selection rules. The implemented general reader endpoints are specified in the following section.

### Shared reader HTTP contract (implemented locally)

All four endpoints derive identity through `getOptionalReader()` / Clerk verification, then reuse authenticated services in `src/lib/actions.ts`. They never authorize with a supplied user, reader, email, shelf-entry or rating document ID. Both successful and handled error responses include `Cache-Control: private, no-store, max-age=0`. No query parameters are accepted. Standard unsupported methods receive Next.js 405 responses, outside the JSON error contract below.

| Endpoint | Request | HTTP 200 response |
| --- | --- | --- |
| `GET /api/reader/profile` | No body or query | `{profile: {displayName, spaceColor, avatarSrc, hasCustomAvatar, ratingCount, reviewCount, ratings, reviews}}` |
| `GET /api/reader/library` | No body or query | `{library: {shelves, ratings}}` |
| `PUT /api/reader/shelf-status` | `{book: {source: "catalog" | "googleBooks", id: string}, status: "wantToRead" | "currentlyReading" | "finished" | null, readingPeriod?: {start?: PartialDate, end: PartialDate}, appendRead?: boolean}` | `{ok: true, bookId: string | null, status}` |
| `PUT /api/reader/rating` | `{bookId: string, value: number | null}` | `{ok: true, bookId, value}` |
| `POST /api/reader/goodreads/preview` | Raw CSV body, `Content-Type: text/csv` (also `text/plain` / `application/csv`). Max **10 MiB**, 10,000 data rows. Clerk Bearer or cookie. | `{preview: {total, valid, matched, unmatched, duplicates, invalid, shelves, issues, owned, books}}`. `books` are titles not already on the reader’s system shelves. Parse/size/header failures are 400 `invalid_request`. |
| `POST /api/reader/goodreads/import` | JSON `{books}` using the existing Goodreads book schema, 1–3 books, max **32 KiB**. Same auth/origin rules as other reader mutations. | `{results: [{row, title, status, message?}]}` where status is `imported` \| `updated` \| `skipped` \| `failed`. Repeats skip owned titles. Ambiguous title/author catalog matches fail that row instead of picking one. Existing ratings, reviews, shelves, and dates are not overwritten or deleted. |

PUT requests require `Content-Type: application/json` and are limited to **8192 UTF-8 bytes**, checked while reading the body. `book` and `status` are required; `readingPeriod` is optional and accepted only with `status: "finished"`. `PartialDate` is a valid, non-future `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` string; when supplied, `start` must not be after `end`. `appendRead: true` requires both Read status and a period. Additional keys (including nested book keys) are rejected. Catalog IDs must be nonblank (trimmed); Google volume IDs use the existing provider-ID validation. Ratings use the existing 0.5–5 half-star schema. Malformed JSON, null/array bodies, missing fields and unrecognized statuses are errors. Mutations reject a supplied Origin that differs from the request URL origin; native requests normally omit Origin. No cross-origin Expo web CORS policy is introduced.

Profile fields:

- `displayName`: string; `spaceColor` and `avatarSrc`: string or null; `hasCustomAvatar`: boolean. `avatarSrc` is the uploaded Sanity avatar when present; the native Clerk SDK can supply the account avatar fallback. Email and Clerk IDs are not returned as identity selectors.
- `ratings`: `[{value, book}]`, where book contains `_id`, `title`, optional/nullable `slug`, `authors`, and `cover`; missing book references are excluded. Most recently updated first.
- `reviews`: `[{title, body, hasSpoilers, visibility, rating, book}]`, where visibility is `private` or `public`, rating is number/null, and book uses the same shape. Only this reader's non-hidden, nonblank reviews with an existing book are returned, including their private reviews.
- Counts equal the lengths of these returned arrays. Companion history is available through the existing `/api/companion/history` contract; this endpoint is not a replacement for that response.

Library fields:

- `shelves`: `[{_id, name, kind, entries}]`, ordered by kind/name. Includes owned custom shelves for reading only; custom-shelf mutations are not added.
- `entries`: `[{_id, addedAt, editionId, book}]`, newest added first. `editionId` is string/null. A deleted/dangling book reference may yield `book: null`; clients must handle it.
- Each library book contains `_id`, `title`, `slug` (falls back to `_id`), `publishedDate`, `myRating`, `percent`, `readingPeriod`, `authors`, `cover`; absent metadata/rating/progress values may be null. `readingPeriod` is projected from the precision-preserving object with legacy exact-date fallback. Status comes from the containing system shelf's `kind`.
- Library `ratings`: `[{bookId, value}]` for the authenticated reader, including rated books no longer on a shelf. It follows the current web read projection; it does not merge legacy duplicates.
- `cover` uses existing web projections: optional `coverOverride.asset.{_id,url}`, `cover.{url,source}`, `coverUrl`, `coverOpenLibraryId`, ISBNs, and `needsCover` (plus crop/hotspot/alt for overrides). Shelf covers prefer the selected edition. Do not assume `cover` is a single URL or expose Sanity credentials to resolve it.
- Both reads are currently unpaginated and uncached, matching the web services.

Shelf operations add or move the book to one of the three system statuses, using the current duplicate handling, dates and edition rules above. **Removal is PUT with `status: null`**, not DELETE by entry ID; it removes owned system placements/progress and leaves custom entries and ratings/reviews intact. For Google Books, a save resolves/imports the work and may select its ISBN edition through the existing workflow; the returned `bookId` is the canonical Sanity work ID. Removing a Google volume that has never been imported returns `bookId: null` and creates nothing. Use the canonical work ID for ratings. No arbitrary shelf/reader ID is accepted.

Rating operations set/update a half-star value only for Currently Reading/Read books; **removal is PUT with `value: null`** and remains allowed after removing reading status. They preserve existing migrated IDs and update the shared book rating aggregate. Mutation responses acknowledge completion; refetch library/profile afterward. Multi-step catalog import, placement, edition lookup and aggregate updates are not one transaction: a 503 may follow a partially completed operation. Refetch before presenting a failure as “nothing changed”; existing repeat-write behavior is preserved. No offline conflict resolution or cross-client write ordering guarantee is added.

Handled errors are `{error: string, code: string}`; clients should branch on status/code rather than parse English messages:

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | Invalid fields/JSON, unknown keys, query parameters, or invalid status/rating |
| 401 | `unauthenticated` | No verified active Clerk session; rejected sessions cannot access Sanity through these routes |
| 403 | `forbidden_origin` | Supplied mutation Origin differs from server origin |
| 404 | `book_not_found` | Unknown catalog book or unavailable Google volume; reader/entry/rating IDs are not book IDs |
| 409 | `reading_status_required` | Non-null rating requires Currently Reading or Read |
| 409 | `shelf_not_found` | Required owned system shelf unavailable after reader setup |
| 413 | `request_too_large` | Body exceeds 8 KiB |
| 415 | `unsupported_media_type` | PUT did not use application/json |
| 503 | `service_unavailable` | Reader setup, Sanity/provider or unexpected operation failure; response hides upstream details |

### Mobile handoff and verification

Set `EXPO_PUBLIC_API_URL` to the reachable origin of the web server containing these routes (no `/api` suffix). Use the matching `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, sign in, and obtain a fresh **session token** with the existing `getToken()` helper. Send `Authorization: Bearer <session token>` on every private API request; no custom JWT template, Clerk secret, Sanity token or reader ID is needed in mobile. This matches Clerk's [Expo useAuth guidance](https://clerk.com/docs/expo/reference/hooks/use-auth) and [authenticated request guidance](https://clerk.com/docs/guides/development/making-requests). Web cookies continue working through the existing Clerk proxy.

Example mobile calls through the existing helper (web implementation only; mobile was not edited):

```ts
const profile = await everlogueFetch('/api/reader/profile', getToken)
const library = await everlogueFetch('/api/reader/library', getToken)
const placement = await everlogueFetch('/api/reader/shelf-status', getToken, {
  method: 'PUT',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({book: {source: 'catalog', id: catalogBookId}, status: 'currentlyReading'}),
})
const rating = await everlogueFetch('/api/reader/rating', getToken, {
  method: 'PUT',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({bookId: catalogBookId, value: 4.5}),
})
// Check response.ok and the error contract, then refetch profile/library.
// Use status: null or value: null to remove. Do not send user/reader IDs.
```

Server configuration remains the existing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_READ_TOKEN`, `SANITY_API_WRITE_TOKEN`. Google Books additions require the existing provider configuration (`GOOGLE_BOOKS_API_KEY`). No new environment variable or JWT template is required. Clerk's existing verifier validates the signature and token time bounds; matching publishable keys alone is not the check. The offline tests inject ephemeral verification keys solely in their harness, never into runtime configuration.

Automated checks exercise the actual new route handlers, `reader.ts`, shared web actions and actual GROQ queries over an in-memory two-reader database. Provider calls and Sanity persistence are fixture boundaries. Coverage includes profile/library isolation, rejected client identity overrides, another reader's document IDs, additions/moves/removals, half-star/status validation, repeated operations, migrated IDs, edition/history preservation, Google resolution/import, and refetching web changes through the API. Separate tests run the actual `src/proxy.ts` callback and installed Clerk middleware with ephemeral RSA-signed session tokens, reconstruct Next's forwarded headers, and use Clerk's verified auth result at the route harness boundary. They check native Bearer and web cookie success, development-mode native success without browser handshake, missing/malformed/forged/expired/future/pending tokens, and spoofed Clerk headers. They do not replace a live Next request-context or configured-Clerk-instance integration test.

Validation on 2026-10-13:

- Focused command: `pnpm exec tsx --test tests/reader-api.test.ts tests/reader-api-auth.test.ts tests/library-book.test.ts tests/reader-profile.test.ts tests/search-book.test.ts tests/import-edition.test.ts tests/home-shelf-routes.test.ts` — **43 passed**.
- Full `pnpm test` — **171 passed, 1 failed**. The unchanged `tests/companion-catalog.test.ts:118` test “series history reports only earlier installments finished by the current reader” returns `[]` instead of `[1]`; it also fails in isolation. Its source and tested companion module are unchanged by this task.
- ESLint on all touched TypeScript files — **0 errors**, two existing unused-parameter warnings in `src/lib/server-actions.ts`.
- `pnpm exec tsc --noEmit` — blocked by the existing `src/app/profile/page.tsx:57` optional companion recommendation count (`number | undefined` passed as `number`). The baseline companion history has a return branch without `count`; those files were not modified. No new TypeScript errors remain in this implementation.
- Documentation links and `git diff --check` passed. Environment files, datasets, deployed configuration and mobile files were not modified.

No application build (given the TypeScript blocker), simulator session, live Clerk session, live Sanity read/write test or deployment is claimed. No server was listening on local port 3000 during inspection. Before mobile rollout, start the web server in the intended environment and test a real Expo token against these endpoints, then verify both directions of shelf/rating refresh plus second-account isolation. Check error responses and clear prior account state on sign-out/switch. Mobile still needs to replace direct private Sanity queries and static shelf fixtures; its bundled token permissions/removal remain unresolved.

### Direct Sanity access and actual mobile connection

Web catalog reads go from server code through `src/sanity/fetch.ts` and `catalogClient`; private reads use `privateClient`; writes use `writeClient()`. All currently disable the Sanity CDN. Tokens use server-only environment names. `src/sanity/client.ts` now has an explicit `server-only` boundary, as do `fetch.ts`, reader/actions, the reader API wrapper and companion server modules. Importing the credential-bearing client into a reader client component is prohibited. Studio components/actions, maintenance/import scripts and backend functions also access Sanity directly.

Mobile currently mixes three patterns:

1. `src/data/companion.ts` and the profile's recommendation-hide action use authenticated web endpoints through `everlogueFetch`.
2. `src/lib/sanity.ts` directly queries Sanity's API using `EXPO_PUBLIC_SANITY_TOKEN`. `src/data/profile.ts` selects a reader by **client-provided Clerk ID OR matching email**, then fetches ratings, reviews and companion history. That query filter is not server-enforced ownership. `src/data/discover.ts` also uses direct Sanity queries for catalog/club content. A configured token is present locally; its actual grants are unverified. A public bundle variable is not a safe home for credentials that grant private dataset access.
3. `src/data/shelves.ts` supplies static shelf fixtures to My Shelves. Its UI IDs (`want-to-read`, `currently-reading`, `read`) differ from server statuses. `src/components/home/picked-shelves.tsx` uses static `src/data/picked-shelves.ts` data, not the home endpoints. No native shelf/rating mutation connection was found.

The mobile profile refetches on focus, history revision/pull-to-refresh, and app foreground via the history refresh trigger. This is direct-data refetching, not proof of shared-API synchronization. Shelf fixtures do not synchronize remotely.

**Documentation discrepancy:** `docs/home-shelves-api.md` says Expo uses the home service with authenticated focus refresh. Current mobile source uses static home fixtures. Its web endpoint description is supported by current source; its mobile integration claims are not. Keep this discrepancy visible until implementation or that document is updated by its owner.

### Environments and development

Configuration was compared locally without displaying secret values. Environment files (`.env`, development variants and local variants) and relevant shell dataset overrides were inspected without printing secret values. Dataset names and key presence/equality were compared. Remote deployments, built mobile bundles, and the environment inherited by any already-running process were not inspected.

| Setting | Observed source/local state |
| --- | --- |
| Web Sanity | `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`; source defaults to the existing project and `production`, API version `2026-02-01`. Local effective file selection is `development`. |
| Mobile Sanity | `EXPO_PUBLIC_SANITY_PROJECT_ID`, `EXPO_PUBLIC_SANITY_DATASET`, `EXPO_PUBLIC_SANITY_API_VERSION`; same default project, dataset default `development`, version default `2025-02-19`. Local project/dataset match web. |
| Studio | Fixed project in `studio/sanity.config.ts`, dataset `SANITY_STUDIO_DATASET` or `production`. No Studio-local dataset override or inherited shell override was found, so local Studio UI targets `production`, unlike web/mobile `development`. `studio/sanity.cli.ts` fixes its API dataset to `production`; verify command targeting separately. |
| Clerk | Local web `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and mobile `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` match. Web also needs server `CLERK_SECRET_KEY`; webhook uses `CLERK_WEBHOOK_SIGNING_SECRET` (legacy fallback `CLERK_WEBHOOK_SECRET`). Matching keys alone do not prove a deployed session is accepted. |
| Backend URL | Mobile requires `EXPO_PUBLIC_API_URL` (origin without `/api`), configured locally. Simulator/device/deployed builds require a reachable environment-specific origin; never embed this workstation path or assume a physical device can reach the host through localhost. |
| Credentials | Web uses `SANITY_API_READ_TOKEN` / `SANITY_API_WRITE_TOKEN`; companion has additional server-only provider/context credentials. No values belong in documentation or reader bundles. Production credentials, dataset ACLs and remote URL compatibility remain unverified. |

**Studio mismatch investigation:** local web/mobile select `development` via their `.env.local`; Studio UI falls back to `production`, and Studio CLI explicitly selects `production`. `docs/BUILD_LOG.md` records the original production Studio scaffold; `docs/book-club-watch.md` recommends a separately targeted development Studio for isolated validation. Neither establishes whether the present local mismatch is intentional. User intent remains unconfirmed; no dataset setting, data, or deployed configuration was changed. An already-running process may have different inherited settings.

Web dev is `pnpm dev` at localhost:3000; Studio is `pnpm studio`, normally localhost:3333. Root `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm start`; `pnpm exec tsc --noEmit` performs type checking. Studio supports `pnpm --dir studio build` and `pnpm --dir studio typegen` (writes schema snapshot/types). Commands were checked against package scripts/configuration; API implementation validation and its limitations are recorded below.

Mobile scripts are `pnpm start` (Expo), `pnpm ios`, `pnpm android`, `pnpm web`, and `pnpm lint`; `pnpm exec tsc --noEmit` uses its TypeScript config. Mobile is tested in a simulator; none was launched for this task. There is no package `test` script. Source/framework versions reflect the inspected manifests, not a runtime certification.

## Target architecture

The web profile/library reads and status/rating HTTP mutations are **implemented locally**. Mobile adoption, deployed verification, credential removal from mobile, and live cross-client consistency are **not completed**. Custom-shelf CRUD, live updates and offline synchronization are outside this implementation.

- Both reader clients use common server-side reader-data rules and ownership checks, owned in this web repository. Private shelves and ratings are read/changed only through authenticated server operations.
- Each operation derives the acting user from verified authentication, resolves the reader by Clerk identity, validates inputs and verifies ownership. Neither client may choose its acting reader by ID or email. Shared endpoints support web Clerk sessions and native Clerk Bearer tokens.
- Neither reader client contains privileged Sanity credentials. Remove the mobile private-data direct-query path and bundled private-access token dependency as part of integration; assess/rotate any exposed credential according to its actual grants.
- Public catalog reads may use a direct/CDN approach where access is intentionally public and needs no privileged token. **Current choice:** retain web server-mediated catalog reads against the private dataset, including the existing 120-second public-row cache. Do not make the mixed catalog/reader dataset public to enable mobile access. Mobile direct catalog reads need a credential-free public boundary or server endpoint before retaining that approach.
- Studio schema changes happen here and are checked for compatibility with both clients. Studio's authenticated editorial access remains distinct from reader API access.
- Adding a book or changing a rating in either client must appear in the other after refresh/refetch with the same account and environment. This acceptance criterion has not been verified or fully implemented, especially native writes.
- Live updates and offline synchronization are separate features, not assumed requirements.

### Open questions and smallest implementation checklist

1. Confirm the intended Studio development dataset and deployed web/mobile Sanity and Clerk environments. Determine mobile token grants and whether a distributed build contains it. Do not silently change environment configuration.
2. Implemented: authenticated profile/library reads and status/rating endpoints reuse `reader.ts`, `actions.ts`, `library-book.ts`, and existing validation. Both web and API call the same services. Responses currently return complete libraries/showcases without pagination; assess large libraries before introducing a versioned paging contract.
3. Automated cookie/native Bearer verification, guest rejection, invalid input, cross-account isolation, repeated writes and migrated identity checks are implemented. Live authentication/environment checks remain. Existing catalog-import concurrency tests remain in the regression suite; no new cross-client concurrency or aggregate consistency guarantee is introduced. The older edition endpoint cache/error consistency remains a separate follow-up; it was not modified here.
4. Coordinate a mobile-owned change to consume the new reads/writes, replace shelf fixtures, map UI statuses explicitly, remove email fallback and privileged direct Sanity access, and refetch after writes/account changes. Align public catalog access separately. Resolve the stale home integration document with its owner.
5. Using the same account/environment in browser and simulator, add/move a book and set/clear a half-star rating in each direction; refetch the other and verify work/edition identity and values. Repeat with another account to confirm private data isolation. Verify sign-out/account switches do not retain the previous reader's data. **These checks have not been run.**

Unresolved product scope includes custom-shelf CRUD and conflict/offline behavior; the presence of a schema or UI fixture does not establish an implemented API or product rule. Live deployment connectivity, permissions, and cross-client consistency remain open even though the inspected local project/dataset and publishable keys match.
