# Everlogue shared architecture

Source-inspected on 2026-10-13 in the current working trees, including uncommitted work. This is the canonical architecture record for web and mobile. Source/configuration findings below are not claims of deployed behavior or passed simulator tests.

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

Web uses Clerk sessions; shared routes are intended to accept mobile Clerk Bearer session tokens through the same middleware. Mobile `src/lib/everlogue-api.ts` calls `getToken()` and attaches `Authorization: Bearer …` to the configured web origin. Actual native token acceptance has not been verified here.

### Reader operations and verified rules

`src/lib/server-actions.ts` exposes Next.js server actions, backed by authenticated functions in `src/lib/actions.ts` and reusable mutation logic in `src/lib/library-book.ts`. These are not a stable mobile HTTP contract. Server reads such as `getMyBooks`, `getReaderBookState`, and `getReaderProfileShowcase` scope queries to the authenticated reader and use no-store reads.

- System status/kind values are `wantToRead`, `currentlyReading`, `finished`; their labels are Want to Read, Currently Reading, Read. `custom` exists in the shelf schema but is not accepted as a reading status. System shelf IDs use `stableId(['shelf', readerId, kind])`; clients should consume returned IDs rather than construct them.
- `saveBookStatus` validates the catalog book and status. Moving status removes entries on other system shelves and preserves the selected edition. Repeating a placement reuses the target entry. Clearing status (`null`) removes system entries and reading progress; it does not delete ratings/reviews or custom-shelf entries. Dates are set if missing. Existing duplicates within the target shelf are not globally repaired.
- `saveBookRating` accepts 0.5–5 in 0.5 increments. `null` removes the found rating; zero is not an unrated stored value. A non-null rating requires Currently Reading or Read. It finds existing ratings by reader/book relationship, preserving migrated IDs, or uses a deterministic ID for a new rating. It recomputes the book's aggregate after mutation. This is not a general duplicate cleanup or proven concurrent aggregate consistency guarantee.
- Reviews require Read status, title 1–120 characters, body 1–8000, and private/public visibility (`src/lib/validation.ts`).
- A book is the shared work identity for shelves, ratings and reviews. An edition is a particular ISBN/copy, not a separate rated work. ISBN validation checks checksum and equivalent ISBN-10/13 duplicates; unchanged reprints reuse the edition. Imports use an ISBN guard. Selection validates that the edition belongs to the book, requires reading progress, and updates owned entries/progress together without changing work identity. See [editions](editions.md).
- Google Books additions resolve/import a catalog book through `setSearchReadingStatus`, `search-book.ts`, and edition helpers before reader placement. Provider IDs, catalog book IDs, slugs, and edition IDs must not be treated as interchangeable.
- Web actions invalidate relevant Next.js paths after changes. They usually return no payload and throw on validation/authentication errors; edition actions return `{ok: true}` or `{error}`, and lookup returns `{editionId, editions}` or `{error}`. There is no common JSON mutation envelope yet.

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

Home book projections include `_id`, title, slug, authors, ratingStats, pageCount, genres, and cover. See `src/lib/home-shelves.ts` and [home shelves](home-shelves-api.md) for selection rules. No general JSON shelf-list/status/rating/profile endpoint exists in this inventory.

### Direct Sanity access and actual mobile connection

Web catalog reads go from server code through `src/sanity/fetch.ts` and `catalogClient`; private reads use `privateClient`; writes use `writeClient()`. All currently disable the Sanity CDN. Tokens use server-only environment names. `fetch.ts`, reader/actions and companion server modules have server boundaries; `src/sanity/client.ts` itself has no `server-only` import and must not be imported into reader client components. Studio components/actions, maintenance/import scripts and backend functions also access Sanity directly.

Mobile currently mixes three patterns:

1. `src/data/companion.ts` and the profile's recommendation-hide action use authenticated web endpoints through `everlogueFetch`.
2. `src/lib/sanity.ts` directly queries Sanity's API using `EXPO_PUBLIC_SANITY_TOKEN`. `src/data/profile.ts` selects a reader by **client-provided Clerk ID OR matching email**, then fetches ratings, reviews and companion history. That query filter is not server-enforced ownership. `src/data/discover.ts` also uses direct Sanity queries for catalog/club content. A configured token is present locally; its actual grants are unverified. A public bundle variable is not a safe home for credentials that grant private dataset access.
3. `src/data/shelves.ts` supplies static shelf fixtures to My Shelves. Its UI IDs (`want-to-read`, `currently-reading`, `read`) differ from server statuses. `src/components/home/picked-shelves.tsx` uses static `src/data/picked-shelves.ts` data, not the home endpoints. No native shelf/rating mutation connection was found.

The mobile profile refetches on focus, history revision/pull-to-refresh, and app foreground via the history refresh trigger. This is direct-data refetching, not proof of shared-API synchronization. Shelf fixtures do not synchronize remotely.

**Documentation discrepancy:** `docs/home-shelves-api.md` says Expo uses the home service with authenticated focus refresh. Current mobile source uses static home fixtures. Its web endpoint description is supported by current source; its mobile integration claims are not. Keep this discrepancy visible until implementation or that document is updated by its owner.

### Environments and development

Configuration was compared locally without displaying secret values. Root `.env`/`.env.local` files were inspected programmatically for equality/presence only; shell overrides, remote deployments and built mobile bundles were not inspected.

| Setting | Observed source/local state |
| --- | --- |
| Web Sanity | `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`; source defaults to the existing project and `production`, API version `2026-02-01`. Local effective file selection is `development`. |
| Mobile Sanity | `EXPO_PUBLIC_SANITY_PROJECT_ID`, `EXPO_PUBLIC_SANITY_DATASET`, `EXPO_PUBLIC_SANITY_API_VERSION`; same default project, dataset default `development`, version default `2025-02-19`. Local project/dataset match web. |
| Studio | Fixed project in `studio/sanity.config.ts`, dataset `SANITY_STUDIO_DATASET` or `production`. Local file/default selection differs from web. `studio/sanity.cli.ts` fixes its API dataset to `production`; verify command targeting separately. |
| Clerk | Local web `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and mobile `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` match. Web also needs server `CLERK_SECRET_KEY`; webhook uses `CLERK_WEBHOOK_SIGNING_SECRET` (legacy fallback `CLERK_WEBHOOK_SECRET`). Matching keys alone do not prove a deployed session is accepted. |
| Backend URL | Mobile requires `EXPO_PUBLIC_API_URL` (origin without `/api`), configured locally. Simulator/device/deployed builds require a reachable environment-specific origin; never embed this workstation path or assume a physical device can reach the host through localhost. |
| Credentials | Web uses `SANITY_API_READ_TOKEN` / `SANITY_API_WRITE_TOKEN`; companion has additional server-only provider/context credentials. No values belong in documentation or reader bundles. Production credentials, dataset ACLs and remote URL compatibility remain unverified. |

Web dev is `pnpm dev` at localhost:3000; Studio is `pnpm studio`, normally localhost:3333. Root `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm start`; `pnpm exec tsc --noEmit` performs type checking. Studio supports `pnpm --dir studio build` and `pnpm --dir studio typegen` (writes schema snapshot/types). Commands were checked against package scripts/configuration; builds/tests were not run for this documentation-only task.

Mobile scripts are `pnpm start` (Expo), `pnpm ios`, `pnpm android`, `pnpm web`, and `pnpm lint`; `pnpm exec tsc --noEmit` uses its TypeScript config. Mobile is tested in a simulator; none was launched for this task. There is no package `test` script. Source/framework versions reflect the inspected manifests, not a runtime certification.

## Target architecture

The full shared reader API is **not implemented yet**. Existing web rules and partial shared routes are the starting point.

- Both reader clients use common server-side reader-data rules and ownership checks, owned in this web repository. Private shelves and ratings are read/changed only through authenticated server operations.
- Each operation derives the acting user from verified authentication, resolves the reader by Clerk identity, validates inputs and verifies ownership. Neither client may choose its acting reader by ID or email. Shared endpoints support web Clerk sessions and native Clerk Bearer tokens.
- Neither reader client contains privileged Sanity credentials. Remove the mobile private-data direct-query path and bundled private-access token dependency as part of integration; assess/rotate any exposed credential according to its actual grants.
- Public catalog reads may use a direct/CDN approach where access is intentionally public and needs no privileged token. **Current choice:** retain web server-mediated catalog reads against the private dataset, including the existing 120-second public-row cache. Do not make the mixed catalog/reader dataset public to enable mobile access. Mobile direct catalog reads need a credential-free public boundary or server endpoint before retaining that approach.
- Studio schema changes happen here and are checked for compatibility with both clients. Studio's authenticated editorial access remains distinct from reader API access.
- Adding a book or changing a rating in either client must appear in the other after refresh/refetch with the same account and environment. This acceptance criterion has not been verified or fully implemented, especially native writes.
- Live updates and offline synchronization are separate features, not assumed requirements.

### Open questions and smallest implementation checklist

1. Confirm the intended Studio development dataset and deployed web/mobile Sanity and Clerk environments. Determine mobile token grants and whether a distributed build contains it. Do not silently change environment configuration.
2. Add an authenticated reader profile/library read endpoint and thin status/rating mutation endpoints reusing `reader.ts`, `library-book.ts`, and validation rules. Define methods, JSON contracts, status codes, private/no-store headers and pagination/limits. Proposed endpoint names are not existing contracts. Keep web actions and HTTP handlers on the same rule implementation.
3. Test cookie and native Bearer identity resolution, unauthenticated rejection, invalid input, cross-account isolation, repeated writes, existing/migrated IDs and concurrency. Fix edition response cache/error consistency when extending that API. Decide handling for existing duplicate records and aggregate races rather than claiming they are already solved.
4. Coordinate a mobile-owned change to consume the new reads/writes, replace shelf fixtures, map UI statuses explicitly, remove email fallback and privileged direct Sanity access, and refetch after writes/account changes. Align public catalog access separately. Resolve the stale home integration document with its owner.
5. Using the same account/environment in browser and simulator, add/move a book and set/clear a half-star rating in each direction; refetch the other and verify work/edition identity and values. Repeat with another account to confirm private data isolation. Verify sign-out/account switches do not retain the previous reader's data. **These checks have not been run.**

Unresolved product scope includes custom-shelf CRUD and conflict/offline behavior; the presence of a schema or UI fixture does not establish an implemented API or product rule. Live deployment connectivity, permissions, and cross-client consistency remain open even though the inspected local project/dataset and publishable keys match.
