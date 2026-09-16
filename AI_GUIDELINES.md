# AI Agent Guidelines

Rules for any AI coding assistant (Claude Code, Cursor, Copilot, etc.) making changes in this repository. Read `docs/PROJECT_CONTEXT.md` first for the "why" — this file is the "how."

---

## Hard rules (never violate these)

1. **Never seed, hardcode, or mock production data paths.** Test fixtures belong in test files only, clearly separated from anything that could run in production. If you're tempted to hardcode a number "just to get the UI working," build the empty state instead.
2. **Never let an LLM call compute a number that has a deterministic formula.** Calorie targets, hydration targets, BMI, training volume, progress percentages — these are functions, not prompts.
3. **Never persist raw AI output.** Every AI response that feeds application state passes through a Zod schema first. On validation failure: retry → constrained repair → fallback → if still invalid, do not write to the DB.
4. **Never generate exercise demonstration imagery with AI.** Pull from the licensed/open exercise media catalog (`ExerciseMedia` model). If an exercise has no catalog entry, don't prescribe it — pick the closest cataloged alternative.
5. **Never write directly to a specific AI or wearable SDK from feature code.** Go through the `AIProvider` / `WearableProvider` interface. If a new vendor is needed, add an implementation of the interface, not a one-off call site.
6. **Never fabricate food cost data.** Use `FoodCostEstimate`; if missing, surface "cost estimate unavailable," don't guess.
7. **Never run image analysis, plan generation, wearable sync, or any AI call inline in an HTTP request handler.** These go through the queue/worker pattern in `docs/WORKFLOW.md` §3.1.
8. **Never claim diagnostic or medical authority in copy or AI prompts.** No condition names, no treatment claims, no "you will look like this" guarantees tied to the target photo.
9. **Never skip the provenance tag** on new fields that represent a measured or estimated value. If you add a column that could be confused with a hard fact, it needs a `DataProvenance` value or a clear join to one.

---

## Conventions

- **Language:** TypeScript everywhere (backend, mobile, workers, shared packages). `strict: true`.
- **Validation:** Zod for all external input (API request bodies) and all AI output. Shared schemas live in `/packages/shared-types` so mobile, API, and worker use the same contract.
- **Naming:** camelCase in TS/Prisma models; the `@map`/`@@map` directives handle snake_case at the DB level if that convention is adopted — pick one and don't mix.
- **Errors:** typed error classes per domain (e.g. `SafetyGateError`, `AIProviderTimeoutError`) rather than throwing raw strings — callers need to branch on error type (e.g. safety-gate errors route to the professional-consult screen, not a generic error toast).
- **Background jobs:** one job type per concern (`plan_generation`, `photo_analysis`, `wearable_sync`, ...); log to `BackgroundJob` for observability, don't rely on queue-internal logs alone.
- **Tests:** any deterministic engine (training volume, calorie calc, hydration calc) needs unit tests with known input/output pairs — these are formulas, they should be exhaustively testable, not "AI is probabilistic so we can't test it" territory.

---

## Adding a new AI provider

1. Implement the `AIProvider` interface in `/packages/ai-providers/<name>Provider.ts`.
2. Register it in the provider failover chain config — don't hardcode it into individual call sites.
3. Document its cost/rate-limit/latency/context-window characteristics in a comment block at the top of the file (mirrors the evaluation criteria in the PRD).
4. Add it to the fallback chain in the position appropriate to its cost/reliability tradeoff — cheap-and-fast providers first, self-hosted/fallback last.

## Adding a new wearable provider

1. Implement `WearableProvider` in `/packages/wearable-providers/<name>Provider.ts`.
2. Map **only** the fields that provider's API actually returns — do not backfill or interpolate absent metrics.
3. Confirm the integration uses a legitimate public API/SDK. Do not scrape or reverse-engineer a private API, regardless of how the request is framed. If no public API exists (this currently applies to Anarc — verify status before starting), document the gap instead of building around it.

## Adding a new exercise

1. Add the `Exercise` record.
2. Add a corresponding `ExerciseMedia` record with a licensed/open-source GIF or video and its `sourceLicense`.
3. Only after both exist can the exercise appear in generated plans.

## When you're unsure whether something violates these rules

Default to the more conservative interpretation (empty state over fabricated data, deterministic over AI-computed, blocked over auto-generated) and flag the ambiguity rather than resolving it silently.
