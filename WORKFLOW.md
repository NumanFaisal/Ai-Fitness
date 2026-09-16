# Workflow

This document covers three distinct workflows: (1) the **build/delivery order** for this project, (2) the **user-facing product workflow**, and (3) the **technical request lifecycle** — how a request actually moves through the system. Read this before touching implementation.

---

## 1. Build / Delivery Order

Do not skip ahead. Each phase depends on decisions locked in the previous one.

```
1. PRD                     ✅ done
2. Architecture validation  ← current phase target
3. Database schema (docs/DATABASE_SCHEMA.md)
4. API contracts
5. AI pipeline implementation
6. Wearable integration spike (confirm Anarc API status first — see §5)
7. UI/UX flows
8. Build
```

**Phase 2 open items before moving to Phase 3:**
- Object storage decision: Cloudflare R2 vs S3 vs Supabase Storage (cost comparison).
- Monorepo tooling: pnpm workspaces assumed; confirm.
- REST vs tRPC: depends on whether mobile + backend share a monorepo/TS boundary.

---

## 2. User-Facing Product Workflow

```
Onboarding → Account Creation → Profile Setup → Fitness/Health Questionnaire
→ Goal Selection → Current Body Photos → Target Physique Photo → Measurements
→ Lifestyle Info → Equipment Availability → Diet Preferences (incl. budget tier)
→ Schedule Preferences
→ AI Analysis (async)
→ Plan Generation
→ Daily Dashboard
→ [Daily Workout | Daily Nutrition/Recipes | Water Tracking | Cardio | Logging]
→ Progress Photo (periodic, not forced daily)
→ Progress Analysis
→ Plan Adaptation
→ Long-Term Transformation Dashboard
```

The **safety gate** sits between the questionnaire and plan generation: unsafe goal/timeline combos or flagged health conditions route to a "consult a professional" screen with a conservative default plan instead of full auto-generation.

---

## 3. Technical Request Lifecycle

### 3.1 General pattern
Anything expensive, slow, or AI-driven is **never** run inline in an HTTP request/response cycle.

```
Client
  → API (validate request, auth check, write minimal DB record e.g. "job: pending")
  → Redis Queue
  → Worker (does the actual work)
  → AI Provider / CV Model / Deterministic Engine
  → Schema validation (Zod) of any AI output
  → Persist to PostgreSQL (+ R2 for media)
  → Push notification to client
  → Client polls or receives push / websocket update
```

Applies to: image processing, AI photo analysis, progress analysis, plan generation (meal + workout), wearable sync, report generation.

### 3.2 Plan Generation Pipeline (detailed)

```
User Data + Body Photos + Target Photo + Measurements + Fitness History + Lifestyle + Goals
  → Validation
  → Image Quality Check (specialized CV model, not LLM)
  → Vision Analysis (labeled Observed / Estimated — never presented as fact)
  → Structured User Profile (merged: user-provided + calculated + observed/estimated)
  → Deterministic Planning Engines
      - Strength/Training Engine (volume, split, recovery rules)
      - Nutrition Engine (calorie/macro targets, budget-tier filtering)
      - Cardio Engine (zones, weekly volume caps)
      - Hydration Engine (formula-based target range)
  → Safety Validation Gate
  → AI Explanation Layer (natural-language framing of the deterministic output)
  → Zod Schema Validation of AI output
      - fail → retry → constrained repair → fallback → never persist raw
  → Persist Plan
  → Push notification: "your plan is ready"
```

### 3.3 Progress Analysis & Adaptation

```
New progress photo + new measurements + logged workouts/nutrition/water + wearable data (if connected)
  → Deterministic stats computation (trend, adherence %, volume completed, etc.)
  → AI trend narrative (hedged language only — no false precision, no exact body-composition claims)
  → Adaptation recommendation (deterministic rule proposes adjustment; AI explains it)
  → User reviews/accepts adaptation → plan updated
```

### 3.4 Wearable Sync

```
Scheduled job (per connected device) OR user-triggered "sync now"
  → WearableProvider.fetch() (Apple Health / Health Connect / Fitbit / Garmin / ...)
  → Normalize into internal schema (steps, HR, sleep, workouts, calories — only fields actually returned)
  → Store as provenance = "wearable"
  → No interpolation to fill missing fields
```

**Anarc Watch:** before building an `AnarcProvider`, confirm whether a public developer API/SDK exists. If not, do not attempt reverse-engineering — fall back to manual entry, or check whether Anarc syncs into Apple Health / Health Connect as an intermediary.

---

## 4. AI Provider Failover

```
Request → Primary Provider (e.g. Groq)
  → timeout/error → Secondary Provider (e.g. Gemini)
  → timeout/error → OpenSourceProvider (self-hosted fallback)
  → timeout/error → FallbackProvider (static/degraded response, never fabricated data)
```

Every provider implements the same `AIProvider` interface so this chain is configuration, not code branching, at the call site.

---

## 5. Adding a New Integration (checklist)

**New AI provider:** implement `AIProvider` interface in `/packages/ai-providers` → register in provider chain config → no other code should import the vendor SDK directly.

**New wearable provider:** implement `WearableProvider` interface in `/packages/wearable-providers` → map only the fields that provider actually exposes → do not synthesize missing metrics.

**New exercise:** must include an entry in the exercise media catalog (GIF/video, licensed/open source) before it can be prescribed by the planning engine — no exercise without a demonstration asset goes live.
