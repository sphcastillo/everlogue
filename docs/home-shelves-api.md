# Shared home shelves

Web and Expo use the same server-side selection service in `src/lib/home-shelves.ts`.
Sanity project/dataset and schema are unchanged. Keep Sanity credentials on the server.

## Endpoints

- `GET /api/home/shelves`: anonymous; returns `{tabs: [{id, label, books}]}`.
  Empty public rows are omitted. Sanity catalog data uses the existing 120-second
  cache. HTTP responses are no-store to avoid caching Clerk session headers at a proxy.
- `GET /api/home/for-you`: Clerk session cookie or `Authorization: Bearer <session token>`.
  Returns `{hasLibrary, tabs}`. No library means `hasLibrary: false, tabs: []`.
  A library with no eligible matches returns a For you tab with an empty books array.
  All responses are private/no-store. Guests receive 401. Upstream failures receive 503.

Book fields: `_id`, `title`, `slug`, `authors`, `ratingStats`, `pageCount`, `genres`,
`cover`. The curated cover URL is `cover.coverOverride.asset.url`.
The backend resolves the reader from verified Clerk identity; neither endpoint
accepts a reader ID supplied by the client.

Public rows prioritize approved editorial collections, then genre fallbacks,
remove duplicates within the row and take at most ten eligible books. Short & sharp
requires 1–250 pages. All rows require a manual cover. Existing For you ranking and
query limits are preserved, including filtering invalid covers after taking ten.

## Expo configuration

The sibling `everlogue-app` home screen now renders `PickedShelves`. It uses the
existing `everlogueFetch` helper and `EXPO_PUBLIC_API_URL` (web origin, without `/api`).
Set this to the deployment containing these routes, or a reachable local web origin
for device testing. A phone cannot reach your computer through `localhost`.
Use matching Clerk instances/environments in both apps.

Public and personalized requests load independently. Requests are cancelled on blur
or account changes, personal results are scoped to user/session identity, and the
screen refreshes on focus. Public browsing does not require a token. Retry is
available for failures. Book cards currently open the web book page because the
mobile project has no native book-detail route.

## Verification

Run the web shelf selection, ranking, loader and route tests; web and mobile
TypeScript checks; and lint. Route tests stub service boundaries: they do not
verify Clerk tokens against a live instance.

After deploying, test on a device:

1. Signed out: public tabs load; direct For you request returns 401.
2. Sign in with the same account as web: confirm matching recommendations.
3. New account with no reading-status shelf entries: public tabs only.
4. Save/rate a book on web, return to mobile home: personal results refresh.
5. Switch accounts or sign out during a request: prior personal results disappear.
6. Offline or server failure: public content remains usable when available, retry works.

Native requests need no browser CORS configuration. Cross-origin Expo web previews
would require a separate allowed-origin CORS policy; none is introduced here.
