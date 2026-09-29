# Path Two submission draft

Do not publish this DEV post without explicit approval.

This is a submission for the Sanity Challenge, Path Two: Vibe-Code Something Strange

## What I Built

Everlogue is a reading companion: a small verified catalog, half-star ratings, private shelves, full genre pages, honest new-release coverage, official bestseller links, celebrity-club months that stay empty until verified, and one community club with a current read, next-read vote, and spoiler-aware discussion. Sanity is the content architecture for catalog, editorial workflow, and reader activity. The dataset is private. Clerk is the sign-in layer (keys still need to be added for judge login).

## Demo

- Live app: https://readevermore.vercel.app
- Studio: run `pnpm studio` locally against project `3h0o1unw` (not publicly deployed in this pass)

## Code

Repository: _add GitHub URL before publishing_

## My Build Process

See `docs/BUILD_LOG.md`. Short version: Cursor vibe-coding on 20 Sep 2026 from a same-day `sanity init` scaffold. Sanity MCP authenticated then timed out; CLI set the dataset private and added CORS. Open Library import wrote 16 works. Icon subpath imports from current Sanity skill docs failed on `@sanity/icons@3.8.0` and were corrected. `defineLive` with a browser token was skipped so reader documents in the private dataset never ship to the browser. Clerk keys were missing, so ratings persistence was not verified with two accounts. Lighthouse mobile: Discover 78 / Browse 99 performance. No Goodreads speed claim.

## Sanity Project Details

- Project ID: `3h0o1unw`
- Dataset: `production` (**private**)
- Do not publish a public dataset query URL; it would be empty or would require leaking reader access

## Judge testing

1. Open https://readevermore.vercel.app — Discover shows Forever fantasy.
2. Browse, Fantasy, a book page (e.g. `/books/a-wizard-of-earthsea`), Releases, Bestsellers, Picks, Clubs.
3. Sign-in / My Books / ratings: **blocked until Clerk keys and a demo account are added.** Until then, rating controls render but cannot persist.
4. Studio Review inbox: Send to review / Approve / Reject. Approved editorial collections appear on Discover.

## Credits

- Sanity, GROQ, Sanity Studio, next-sanity, @sanity/client
- Open Library metadata and covers displayed from `covers.openlibrary.org`
- Clerk (wired; keys not yet present)
- Arc Browser as warmth/interaction inspiration; identity is original
- Vercel hosting

## Limitations

- Small imported catalog, not every release
- Celebrity months empty unless independently verified
- Bestseller pages are outbound links only
- Fantasy by Year uses in-app ratings; currently falls back to a labeled editorial shelf
- No Sanity App SDK Dashboard app
- Clerk demo account not issued yet
- MCP tools were not usable in this session after auth timeouts

## Tags

Copy the official Path Two template tags from the live DEV launch post, including the required `sanitychallenge` tag, immediately before publishing.

---

Status: draft only. Not published.
