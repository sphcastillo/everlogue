# Reading Companion

The existing Ask Everlogue chat posts to `/api/companion`. The server uses OpenAI `gpt-5.4-mini` and the AI SDK MCP client to retrieve supporting content from:

`https://api.sanity.io/v1/context/organizations/oWrzPSsUw/mcp/everlogue-book-knowledge`

Set these server-only variables in `.env.local` and in the deployment environment:

- `OPENAI_API_KEY`
- `SANITY_ORGANIZATION_TOKEN` — organization token with Context → Viewer permission.

The organization token is separate from `SANITY_API_READ_TOKEN`, which the existing application uses for Content Lake reads. Never prefix either secret with `NEXT_PUBLIC_` or commit its value.

The endpoint currently serves Knowledge Base tools: `initial_context`, `knowledge_base_search`, and `knowledge_base_read`. Tools are discovered dynamically through `mcpClient.tools()`. It does not currently expose the GROQ tools in the original integration brief. The Knowledge Base covers only part of the catalog; the companion must not equate missing knowledge with catalog unavailability.

Content-answer requests start with `initial_context` and require a retrieval step before answering, with a maximum of ten model steps and a 90-second generation deadline. Answers include source URLs. Personal library context comes only from the existing authenticated shelf-loading functions, limited to 30 books per shelf with truncation indicated. Guest requests contain no private library context. Catalog questions also work for guests, as the existing Companion did. Context source permissions and filters must remain limited to the content intended for these readers.

The endpoint streams newline-delimited JSON containing text deltas, retrieval tool names (no arguments or source payloads), completion, or a sanitized error. The existing chat progressively displays text and reports interrupted responses. Responses are private and uncached. The MCP client closes on completion, cancellation, or failure. OpenAI response storage is disabled.

## Verify locally

With `pnpm dev` running and both credentials configured:

```sh
node scripts/test-reading-companion.mjs
```

An optional URL argument targets another environment. This test makes a real, billable OpenAI request. It checks request validation, streamed text, MCP retrieval events, and the author/source citation for The Christie Affair. It does not replace source review for every possible model answer.

References: [Sanity Context](https://www.sanity.io/docs/ai/sanity-context), [AI SDK MCP client](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools), [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Recommendations

“What should I read next?” returns exactly: “What are you in the mood for—or what’s a book you loved and want something similar to?” This opening needs no model call. Chat history carries the answer into the next request.

After the reader supplies a preference, the server provides a `search_catalog` tool that queries all published books through `@sanity/client`, using catalog descriptions, genre titles, and imported categories. It ranks keyword/synonym matches and returns up to 30 candidates per search; the model selects three plausible matches and explains their metadata-based fit. A loved-book lookup can supply catalog themes before searching. The model can broaden its search when matches are sparse; it must not invent three matches if fewer are supported.

Want to Read books are eligible and labeled. Exclusions for finished/currently reading books are enforced in GROQ using the server-authenticated reader ID, across all shelf entries (not the truncated library context sent to the model). Another reader’s shelves do not affect results. If the authenticated library cannot be verified, recommendations fail closed. Guests receive catalog recommendations without personalized exclusions.

No Knowledge Source or ingested article is required. Knowledge Base retrieval optionally adds article-backed detail with citations. Catalog-only explanations identify descriptions/genres as their basis and do not invent article citations.

```sh
pnpm exec tsx --test tests/companion-catalog.test.ts
node scripts/test-companion-recommendations.mjs
```

The first command uses an isolated fixture for shelf exclusions, Want to Read, guest isolation, and sourceless-book eligibility. The second makes a real OpenAI request through the local API for the mood-question → hopeful friendship → three choices conversation.

## Ratings, limits, and feedback

The server fetches only the authenticated reader's most recent 80 ratings and 40 visible reviews, including their own private reviews and rated books no longer on a shelf. Guests get no personal preference data. Rating/review loads are uncached; failures are marked unavailable rather than treated as an empty preference profile.

Ratings are soft signals: 4–5 stars indicate enjoyment of that book; 0.5–2 stars indicate a possible mismatch with an unknown cause unless explained. Unrated books remain unknown. The current request always takes priority, and low ratings never impose genre bans. Reasons stated in saved reviews or user messages can refine choices; a relevant unexplained low rating can prompt “What didn’t work for you about that book?” instead of forcing three recommendations.

Suitable Want to Read books receive a tie-break boost after relevance. Explicit page limits, excluded genres, and standalone requirements filter known contradictions. Searches retain constraints across retries. Books with missing hard-limit metadata are reported as unverified and are withheld from the model's eligible recommendation list, with the missing metadata identified. No metadata is automatically invented or backfilled.

Books now have optional `isStandalone` and `series` (`name`, `position`) fields in Studio. Unset means unknown. Series metadata and the authenticated reader's finished installments let the model prefer the first installment unless predecessors were read. Candidates are deduplicated by normalized title/author, and the prompt asks for three varied, supported fits rather than near-identical choices. Fewer matches are allowed; the companion asks before relaxing limits.

Readers can type “more like this,” “not for me,” or “I've already read this.” The companion resolves the referenced title, uses it as an anchor or excludes it from subsequent searches, and asks when the reference is ambiguous. Feedback remains within the supplied conversation history (currently the last 12 messages); this does not write ratings, reviews, or shelf changes.

Validation: `pnpm exec tsx --test tests/companion-catalog.test.ts tests/companion-preferences.test.ts`.
