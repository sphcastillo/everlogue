# Companion measurement and limits

The model remains `gpt-5.4-mini`. Sanity Studio → **Companion usage** shows one record per admitted question, with stage-level input, cached input, output, reasoning tokens, estimated USD, duration and outcome. For aggregate totals run `pnpm exec tsx scripts/companion-usage-report.ts 7` (the last seven days). Only new traffic is measured; this cannot reconstruct the OpenAI dashboard's older requests.

Defaults, configurable through server environment variables in Vercel:

| Variable | Default | Scope |
| --- | ---: | --- |
| `COMPANION_DAILY_LIMIT` | 200 | All paid companion questions in this dataset per UTC day |
| `COMPANION_READER_DAILY_LIMIT` | 20 | Each authenticated reader per UTC day |
| `COMPANION_GUEST_DAILY_LIMIT` | 30 | Shared anonymous pool per UTC day |

Zero disables that audience (global zero disables all model calls). Invalid configuration fails closed. Guests share a pool intentionally: cookies and request headers cannot create new allowances. Signed-in readers also wait ten seconds between accepted questions. Rejections return HTTP 429 with `Retry-After`, displayed by the existing chat UI. The fixed mood opener uses no model and no allowance. Failed/cancelled admitted questions still consume allowance to prevent retries bypassing protection.

Admission updates the global and audience counters and creates the usage document in one revision-checked Sanity transaction. Authoritative document reads and conflict retries protect against parallel Vercel instances and stale query indexes. If accounting storage is unavailable, generation does not start. Quotas are per dataset: keep development and production separate. Credentials use the existing server-only `SANITY_API_WRITE_TOKEN`; rotating it changes the pseudonymous reader guard for that day, while the global counter still applies.

Recommendation context retains all eligible candidates (up to 30), shortening descriptions to relevant source excerpts. Selection sees up to ten relevant recent ratings and four review excerpts, instead of 80 full rated-book descriptions and 40 full reviews. Current conversation, hard preference checks, fresh shelf exclusions, Want to Read preference, series metadata, and source-less book eligibility remain in place. No library-data cache is added. Excerpts are incomplete evidence: omitted details must never be invented.

Requests are bounded to 32 KB including history. Interpretation and selection each have 1,400 output tokens; writing has 1,200; clarification has 160. Sanity Context answers have at most six model steps and 1,800 output tokens per step, with an 80,000-character serialized message limit before each model call. The final permitted step must answer without additional tool calls. Automatic model retries are disabled so hidden retries cannot multiply usage. The existing 90-second generation deadline remains.

Cost estimates use the standard model prices checked October 4, 2026: $0.75/M uncached input, $0.075/M cached input, $4.50/M output ([official model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini)). Reasoning is included in output tokens, never billed twice in our estimate. These are question limits, **not a dollar spending cap**. Provider billing remains authoritative; interrupted calls may incur usage the SDK never reports. Failed/cancelled requests are marked incomplete; process crashes leave `started` records. Persistence failures emit `companion_usage_persistence_failed`; numeric summaries also appear as `companion_usage` in server logs. No prompts, replies, reviews, tool payloads, raw reader IDs or IP addresses are stored in these records.

Deploy the app and Studio schema together. Review incomplete records and average cost per question before raising limits. Keep these private operational document types out of Sanity Context knowledge-source mappings. Counter and usage records are retained; no automatic deletion is configured. Avoid deleting today's guards, which would reset allowances.
