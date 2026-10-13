# Everlogue web — Cursor and Codex

- Confirm the full target repository path before editing. This checkout is `/Users/sphcastillo/devPlayground/everlogue` (web); mobile is `/Users/sphcastillo/devPlayground/everlogue-app`. These are local navigation hints, never runtime constants.
- Work in this repository. Mobile may be read for context; do not modify it without explicit authorization.
- This repository owns the Next.js web UI, Sanity Studio in `studio/`, and existing shared HTTP endpoints/server operations. The shared reader API is incomplete; do not describe the target as implemented.
- Read [docs/shared-architecture.md](docs/shared-architecture.md) before changes affecting data, authentication, APIs, Studio schemas, or both clients. It is the canonical cross-project architecture record. Read its relevant feature references too.
- Inspect current code before relying on documentation. Report discrepancies and distinguish source inspection, executed checks, and live verification. Update documentation when authorized behavior changes.
- Give each change one implementation owner. Reviewers inspect and report findings without independently editing the owner's files. Coordinate API contracts and Studio schema changes with the mobile implementation owner and check compatibility with both clients.
- Inspect the working tree first; preserve unrelated edits, deletions, and untracked files. Do not reset or overwrite another owner's work.
- Keep private reader operations authenticated on the server; derive identity from verified authentication and enforce ownership and input validation. Never put privileged Sanity credentials in either reader client. Keep the shared dataset private; do not print, copy, or commit secrets.
- Do not hardcode user-provided paths or environment-specific URLs/settings into runtime code. Use the appropriate environment configuration. Verify dataset targeting before commands that can write data; local development does not imply a development dataset.
- For documentation-only work, edit documentation only: leave application code, schemas, dependencies, environment files, and deployed services unchanged.

## Commands

Verified against root and Studio package scripts and README; listing a command does not mean it passed in the current checkout. Use pnpm.

| Purpose | Command |
| --- | --- |
| Web development, `http://localhost:3000` | `pnpm dev` |
| Studio development, normally `http://localhost:3333` (check printed port) | `pnpm studio` |
| Unit tests | `pnpm test` |
| Focused tests | `pnpm exec tsx --test tests/reader-profile.test.ts tests/library-book.test.ts tests/home-shelf-routes.test.ts` |
| Lint | `pnpm lint` |
| Web type check | `pnpm exec tsc --noEmit` |
| Production build / serve | `pnpm build` / `pnpm start` |
| Studio build | `pnpm --dir studio build` |
| Regenerate schema snapshot and web types (writes generated files) | `pnpm --dir studio typegen` |

Run checks appropriate to the change and report failures honestly. The documented unit suite uses fixtures/fakes; it does not establish live authentication or cross-client synchronization. Mobile uses Expo and a simulator; its scripts are documented in the architecture record. Do not run imports, migrations, deployments, or billable companion smoke tests as incidental documentation validation.
