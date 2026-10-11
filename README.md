# Everlogue

A home for readers. Next.js App Router, Clerk, and a private Sanity dataset.

Sanity project: `3h0o1unw`. Keep that dataset **private**. Never commit tokens.

## Run locally

You need **Node.js**, **pnpm**, and two terminals.

1. Install dependencies from the repo root:

```sh
pnpm install
pnpm --dir studio install
```

2. Copy env vars:

```sh
cp .env.example .env.local
```

Fill in `SANITY_API_READ_TOKEN`, `SANITY_API_WRITE_TOKEN`, and the Clerk keys. Optional: `OPENAI_API_KEY` for the reading companion, `OPEN_LIBRARY_CONTACT_EMAIL` for Open Library search.

3. Start the reader app:

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

4. Start Studio (catalog and reader data):

```sh
pnpm studio
```

Open [http://localhost:3333](http://localhost:3333). If that URL shows another project's Studio, something else is already on port 3333 (`lsof -nP -iTCP:3333 -sTCP:LISTEN`). Use the address this Studio printed, or stop the other process and run `pnpm studio` again.

Signed-in visits create a Sanity `readerProfile` from the Clerk user. Webhooks are only needed to keep names and avatars in sync on a public URL; local sign-in works without them.

## Tests

After you change catalog, Watch, imports, companion, shelves, or related library code:

```sh
pnpm test
```

That runs every file in `tests/` with Node’s test runner. They stay in memory (fake Sanity + fixtures). They do not open Studio or write to a live dataset.

One area only:

```sh
pnpm exec tsx --test tests/book-club-watch.test.ts
```

Watch also has `pnpm watch:test`. There is no CI job for these yet.

| File | What it locks in |
| --- | --- |
| `book-club-watch.test.ts` | Watch discovery, Review queue publish, catalog review status |
| `goodreads-*.test.ts`, `catalog-*.test.ts`, `search-book.test.ts` | Imports, matching, failed imports, catalog lookup |
| `companion-*.test.ts` | Companion catalog, links, usage, preferences |
| `for-you-picks.test.ts`, `home-shelf-data.test.ts`, `book-covers.test.ts` | Homepage / For You / covers |
| `reader-profile.test.ts`, `library-book.test.ts` | Profiles and shelves |
| `club-*.test.ts`, `jenna-*.test.ts` | Club lists and Jenna matching/import helpers |
| `book-migration.test.ts`, `import-edition.test.ts` | Older catalog/edition import rules |

Drop a file only if you delete the feature it tests.

## Other commands

```sh
pnpm build          # production Next.js build
pnpm start          # serve that build
pnpm lint
pnpm --dir studio typegen
```
