# Book Club Watch

Watch checks official announcements and creates **discovery documents**, not catalog books. **Book Club Watch → Review queue** showcases the title, cover, club, source, and selection month. Editing happens in **Everlogue Catalog Requests → Bookclub imports**: choose **Review book import**, edit the regular book form, then **Publish**. This opens a draft (or preserves an existing book's metadata in a draft) and never publishes on discovery or handoff.

After the regular Publish succeeds, Studio confirms the live book, reuses the club collection by ID or slug (or creates it if the dataset has none), adds the selection without replacing collection history, and files the discovery under **Approved**. There is no separate Watch approval step. If collection completion fails, the discovery stays in review with an error; use **Finish Watch review** on the published book to retry. That action never creates or overwrites a catalog book. Rejected discoveries can still be reopened.

Deploy the updated Studio and Blueprint/functions together. The legacy discovery publisher remains for older approval snapshots but ignores records handed off through `catalogBook`; those records remain `approved`, rather than being moved to `published`.

## Schedules

All schedules use `America/New_York`, including daylight-saving transitions:

| Club | Schedule | Eligibility |
| --- | --- | --- |
| Reese | 9 AM, days 1–8 | Stop when this month's selection/discovery exists |
| GMA | 10 AM every Tuesday | No day-10 cutoff; stop when this month's selection/discovery exists |
| Jenna | 9 AM Monday/Tuesday | Function exits after day 8 |
| Oprah | 9 AM Monday/Wednesday/Friday | Latest announcement, without a monthly limit |

Every scheduled invocation writes `bookClubWatchRun`, including skipped, disabled, no-change, already-recorded, and failed checks. A run left `running` may have timed out; inspect function logs. Failed/incomplete monthly runs allow another source fetch so a partial multi-title discovery does not suppress the rest of the announcement. History is retained indefinitely in v1.

The source parsers use official selection headings and announcement dates, never the crawl date or the book's publication date. A valid archive without the target month means no change; blocked pages and unrecognized structure mean failure. GMA/Oprah fetch live pages rather than using the historical importer arrays. Reese/Jenna parsers are shared with the existing CLI imports. Historical CLI imports remain separate; Watch does not run them.

## Local validation (no remote mutations)

```sh
pnpm run watch:test
pnpm run watch:check
pnpm run watch:build
pnpm --dir studio exec tsc --noEmit
pnpm run watch:preview --club reese --date 2026-10-01
pnpm run watch:preview --club gma --date 2026-10-06
pnpm run watch:preview --club read-with-jenna --date 2026-10-05
pnpm run watch:preview --club oprah --ignore-window
```

The preview command is always read-only, accepts an ISO date/time, and needs no Sanity token. `--ignore-window` bypasses only the calendar guard. Function CLI tests with `context.local` also never mutate Sanity. Handler bundles are built in the OS temporary directory. Tests use the real Sanity transaction builders and GROQ evaluator against an isolated in-memory store; they do not claim to validate a deployed dataset.

## Sanity setup and isolated-dataset rollout

Prerequisites: Node 24, organization-scoped Blueprint access, Functions scheduling entitlement, and deployment permissions. See [scheduled functions](https://www.sanity.io/docs/functions/scheduled-function-quickstart). This repository does not provision or assume a production stack. The first planning attempt parsed all six resources but could not compare with a remote stack because no Blueprint configuration was linked.

1. Use the private `development` dataset for isolated validation; keep `production` for live content. Seed the four `curatedCollection` documents with the IDs in `src/lib/book-club-watch/model.ts` and empty `books` arrays. Do not test against production reader data.
2. Initialize an organization-scoped Blueprint stack **from the repository root**, preserving the existing `sanity.blueprint.ts`. Use `sanity blueprints init --help` for the installed CLI's organization/stack options. Link `.sanity/blueprint.config.json` locally; never commit credentials. Use a separate validation stack and production stack.
3. Export the configuration explicitly. The Blueprint has no default dataset and fails closed when it is missing:

   ```sh
   export WATCH_PROJECT_ID=3h0o1unw
   export WATCH_DATASET=development
   export WATCH_ENABLED=false
   pnpm --dir studio exec sanity blueprints plan
   ```

   Run CLI commands from the root if your CLI cannot locate the parent Blueprint, or set `SANITY_BLUEPRINT_PATH` to the absolute path to `sanity.blueprint.ts`.

4. Review the plan, then deploy to the **validation stack**. The Blueprint creates one project editor robot and five functions. The robot role can mutate project documents: keep its token out of the app/browser and use project governance/custom roles if tighter dataset restrictions are required. It is referenced by Blueprint resource, not embedded in source.
5. Set `GOOGLE_BOOKS_API_KEY` via `sanity functions env add` for each of the four scheduled functions, or the Functions settings UI. Never commit the value. Missing enrichment credentials leave the official discovery reviewable with an enrichment error.
6. Enable `WATCH_ENABLED=true` in the validation Blueprint environment, plan and deploy again. Point a local Studio at the isolated dataset for review validation (do not change the production Studio deployment). Wait for an eligible scheduled run. Check source failures and logs rather than interpreting empty discoveries as success.
7. Open a discovery from Bookclub imports, publish its book, and verify exactly one book/selection and `approved` status; try rejection/reopening and **Finish Watch review**. Confirm draft editing alone creates no catalog content. Verify run history and all four source adapters. Remote dataset validation and scheduling entitlement are required before production enablement.
8. Only after validation, plan/deploy the production stack with `WATCH_DATASET=production`, `WATCH_ENABLED=true`, and `WATCH_PRODUCTION_VALIDATED=true`. Also deploy the updated Studio. The last variable is a deliberate rollout acknowledgement, not proof supplied by the code.

The standard deployment CLI is `sanity blueprints plan` followed by `sanity blueprints deploy`. Use the installed Studio CLI or `pnpm dlx sanity@latest` from the root. Blueprint schedules exist after deployment, but disabled handlers only record a skipped run; the publisher exits without writes. Disable `WATCH_ENABLED` to pause work without deleting infrastructure or history.

## Review and recovery

Current flow: `discovered → needs_review → approved`, with approval following catalog publication. `published` is retained for legacy history. Reviewers can reject a pending discovery and reopen rejected items. These names intentionally do not replace the pre-existing catalog `needsReview` workflow.

- Matching scores are deterministic rules, not probabilities. Unique title/author matches rank 0.98; a verified matching ISBN ranks 1. Provider-only title matches are weak suggestions (0.6), other suggestions 0.2. None authorize publication.
- Watch is a read-only showcase. Edit proposed title, authors, cover, and other metadata in the regular catalog book form opened from Bookclub imports. A linked existing book keeps its editorial metadata.
- A failed enrichment leaves `needs_review` with source evidence. Review manually; it never discards the discovery.
- If catalog publication succeeds but collection completion fails, the discovery remains in review with `processingError`. Resolve any permission, duplicate-collection, or network issue, then choose **Finish Watch review** on the published book. Repeated completion does not duplicate collection entries.
- The handoff uses a draft ID and a revision check on the discovery to prevent duplicate drafts. Completion uses revision-checked collection/discovery updates. It preserves existing metadata and historical selection entries. Collection entries are the current source of club membership; Watch does not restore the removed `book.clubs` field.
- All Watch items are read-only showcases. Subsequent catalog corrections belong on the book or collection.
- Same-candidate rejected discoveries remain suppressed. A different title can still be discovered. Oprah does not stop after one pick per month.
- Do not delete identity-guard documents independently of their discoveries/books. They prevent concurrent duplicate creation; orphan guards need a deliberate repair after inspecting the corresponding source identity.
- `sanity functions logs <function-name>` provides execution logs. Stored errors are deliberately sanitized and omit arbitrary client/provider messages and credentials.

No email/Slack notifications, historical backfill, or automatic history deletion are included.
