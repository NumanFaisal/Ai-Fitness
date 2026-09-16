# Project Context (for AI assistants)

Read this before making any change to this codebase. It's written for an AI coding agent (Claude Code, Cursor, or similar) picking up work here — it gives the "why," not just the "what." For coding-style rules, see `docs/AI_GUIDELINES.md`. For schema, see `docs/DATABASE_SCHEMA.md`. For request flow, see `docs/WORKFLOW.md`.

---

## What this product is

A mobile app that generates and adapts personalized fitness/nutrition plans from a user's real profile, body photos, a target-physique reference photo, and (optionally) wearable data. It behaves like a coach: it explains, adapts, and answers situational questions grounded in the user's actual logged data — it does not just hand out a generic plan once.

## What this product is explicitly not

- Not a medical or diagnostic tool. It never diagnoses conditions or claims to replace a doctor, dietitian, physiotherapist, or trainer.
- Not a guarantee machine. The target-physique photo is a directional reference, never a promised outcome.
- Not a demo/prototype. There is no acceptable "fake data for now" state in anything that ships — see the provenance rule below.

## The rule that shapes almost every design decision: data provenance

Every value shown to a user is one of:

| Tag | Meaning |
|---|---|
| `USER_PROVIDED` | The user typed/selected it |
| `CALCULATED` | Deterministic formula output (BMI, calorie target, hydration target, volume progression, progress stats) |
| `WEARABLE` | Came from a connected device/platform, unmodified |
| `OBSERVED` | Directly visible in an uploaded photo (per CV/vision analysis) |
| `ESTIMATED` | Inferred with uncertainty — must ship with a confidence value, never a bare number |

If a screen or API response would show a number with no real provenance behind it, that's a bug — not a temporary placeholder. The correct behavior is an empty state ("No activity data yet. Connect a wearable or record your workout.") with a clear next action.

## Where AI is allowed to act, and where it isn't

**AI is responsible for:** personalization framing, natural-language coaching/explanation, recipe generation, conversational Q&A grounded in the user's real data, image *description* (not measurement), adaptation suggestions phrased in hedged, trend-based language.

**AI is never responsible for:** the actual calorie/macro/hydration/volume numbers (those come from deterministic engines — see `docs/WORKFLOW.md` §3.2), diagnosing anything, inventing a body-composition number, generating exercise demonstration media (that's a licensed/open media catalog, never AI-generated imagery — wrong-form imagery is a real injury risk), or writing to the database without passing through Zod schema validation first.

If you're implementing a feature and find yourself asking an LLM to compute a number that should be deterministic, stop — that's the wrong layer for it.

## Safety gate

Before any plan is auto-generated, a safety check runs against injuries, flagged health conditions, and goal/timeline combinations that are physiologically unreasonable (e.g. large fat loss in a very short window). If it trips, the user is routed to a conservative default plan plus a "consider consulting a professional" message — auto-generation does not proceed as normal.

## Budget-aware nutrition

Food budget is a required onboarding field, not optional. The nutrition engine filters candidate meals/recipes by the user's budget tier *before* balancing macros — plans should never propose food outside what the user said they can afford. Food cost data comes from a maintained cost table (`FoodCostEstimate`), never an AI guess; if cost is unknown, show "cost estimate unavailable" rather than fabricating a number.

## Provider abstraction (AI and wearables)

Two vendor-neutral interfaces exist specifically so no feature code ever imports a specific AI or wearable SDK directly:

- `AIProvider` — Groq / Gemini / open-source / fallback, chained with failover.
- `WearableProvider` — Apple Health / Health Connect / Fitbit / Garmin / etc.

Anarc Watch is a named target but its public API status is unconfirmed — check `docs/WORKFLOW.md` §3.4 before building anything Anarc-specific.

## Glossary

- **Engine** — a deterministic module producing a calculation (training volume, calorie target, etc.).
- **Explanation layer** — the AI step that turns an engine's output into coaching language.
- **Provenance** — see table above; enforced at the data layer, not just displayed in the UI.
- **Safety gate** — the check that blocks unsafe auto-generated plans.
- **Adaptation** — a plan change proposed by the deterministic rules layer based on logged progress, explained by AI, and confirmed by the user before it takes effect.
