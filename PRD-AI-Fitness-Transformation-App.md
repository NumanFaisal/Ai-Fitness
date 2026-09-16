# Product Requirements Document
## AI-Powered Fitness & Body-Transformation Application

**Status:** Draft v1 — for review before architecture/DB/API work begins
**Author:** Claude (drafted with Numan)

---

## 1. Executive Summary

A mobile-first application that acts as an intelligent, data-honest personal fitness coach. It ingests real user data (profile, body photos, a target-physique reference, measurements, wearable data), generates a personalized training/nutrition/hydration plan through a deterministic-engine + AI-explanation architecture, and adapts that plan over time based on actual logged progress — never fabricated data.

The two design commitments that shape every decision below:

1. **No dummy data, ever.** Every number on screen is either user-entered, database-derived, wearable-sourced, or a clearly-labeled AI estimate. Missing data renders as an empty state with a call to action, never a fake number.
2. **AI explains and personalizes; it does not calculate or diagnose.** BMI, calorie targets, hydration targets, volume progression, and progress stats are deterministic. AI handles natural-language coaching, recipe generation, image interpretation (labeled as estimates), and adaptive recommendations — and is schema-validated before anything is persisted.

---

## 2. Goals & Non-Goals

**Goals**
- Real, working app — not a prototype with placeholder content.
- Personalized daily training, nutrition, cardio, and hydration guidance that adapts to logged progress.
- Photo-based progress tracking with AI trend interpretation (not diagnosis).
- Optional wearable integration via legitimate health platforms (Apple Health, Health Connect, Fitbit, Garmin, etc.).
- An in-app AI coach grounded in the user's actual stored data.
- A cost-conscious AI architecture (free/low-cost tiers during development, provider-swappable).

**Non-Goals (v1)**
- Medical diagnosis or treatment of any kind.
- Guaranteeing a specific physique outcome from the target photo.
- Reverse-engineering or scraping proprietary wearable APIs without a public SDK (e.g., if Anarc has no public developer API, it is out of scope until one exists — see §10).
- Social/community features, marketplace, or coach marketplace (candidate for v2).
- Native smartwatch app (v1 is a companion-data consumer, not a watch app).

---

## 3. Core Product Principles (Non-Negotiable)

| Principle | Implementation |
|---|---|
| No dummy data | Empty states everywhere data doesn't exist yet; no seeded fake metrics in prod |
| AI doesn't invent facts | All physiological/nutrition calculations are deterministic; AI output is schema-validated |
| Data provenance is visible | Every displayed value is tagged internally as `user_provided`, `calculated`, `wearable`, `observed`, or `estimated` |
| Safety first | No diagnosis, no extreme-deficit/extreme-volume plans, referral to professionals when flagged |
| Target photo = reference, not promise | UI copy and AI language always frame it as directional, not guaranteed |

---

## 4. User Journey

```
Onboarding → Account Creation → Profile Setup → Fitness/Health Questionnaire
→ Goal Selection → Current Body Photos → Target Physique Photo → Measurements
→ Lifestyle Info → Equipment Availability → Diet Preferences → Schedule Preferences
→ AI Analysis (async) → Plan Generation → Daily Dashboard
→ [Daily Workout | Daily Nutrition/Recipes | Water Tracking | Cardio | Logging]
→ Progress Photo (periodic) → Progress Analysis → Plan Adaptation
→ Long-Term Transformation Dashboard
```

Onboarding is designed to be resumable — a user can exit after profile setup and return later; plan generation only fires once the minimum required inputs exist (see §5).

---

## 5. User Profile — Required vs Optional Fields

**Required to generate a plan:** name, age, biological sex (for calculation purposes only, clearly explained), height, weight, primary goal, fitness/training experience level, available equipment, workout days/week, session duration, dietary preference, known allergies, injuries/limitations (can be "none"), **food budget tier** (needed to gate the diet engine — see §7.2).

**Optional, improves personalization:** target date, occupation activity level, disliked foods, cuisine preference, meals/day, cooking ability, sleep schedule, current water intake habit, preferred training environment (gym/home/outdoor).

**Goal taxonomy:** fat loss, muscle gain, recomposition, strength, endurance, general fitness, athletic performance, maintenance.

A **safety gate** runs after the questionnaire: if injuries, certain health conditions, or extreme goal/timeline combinations (e.g., "lose 20kg in 4 weeks") are entered, the system blocks unsafe auto-generation and instead shows a professional-consultation recommendation plus a conservative default plan.

---

## 6. Photo System

### 6.1 Current Body Photos
Guided capture flow (front/back/left/right) with on-device checks for lighting, framing, and distance consistency before upload, so later comparisons are valid.

### 6.2 Target Physique Photo
Treated strictly as a **reference**, not a promise. AI output is limited to general, non-identifying descriptors: apparent muscularity emphasis, proportion focus, general training direction. UI copy explicitly states genetics/training history/starting point affect real-world outcomes.

### 6.3 Data Provenance Labeling (critical)
Every photo-derived data point is tagged as one of:
- **Observed** — directly visible in the image (e.g., "visible increase in shoulder definition")
- **Estimated** — inferred with uncertainty (e.g., estimated body-fat range) — always shown with a confidence indicator, never a bare number
- **User-provided** — explicitly entered
- **Calculated** — deterministic formula output

No photo analysis is ever presented as a lab-grade measurement.

---

## 7. Personalization Engines (Deterministic Core + AI Layer)

| Engine | Deterministic Responsibility | AI Responsibility |
|---|---|---|
| Strength Training | Volume/frequency/split logic, progressive overload rules, recovery constraints, exercise selection from a rules-filtered pool | Explaining the "why," suggesting substitutions in the coach chat |
| Cardio | Duration/intensity zones from formulas, weekly volume caps | Adapting phrasing/motivation, treadmill program narrative |
| Nutrition | Calorie target (Mifflin-St Jeor or similar validated formula × activity factor), macro split, meal count, **budget-tier food filtering** (see §7.1) | Recipe generation, food substitutions, cuisine personalization |
| Hydration | Formula-based target range (body weight, activity, climate input) | Coaching nudges |
| Progress | All stats computed from DB records | Trend narrative, "what this likely means," never false precision |

**Training volume distribution** follows evidence-based split logic (push/pull/legs, upper/lower, full-body — chosen by days/week and experience) with hard caps preventing overlapping muscle groups on adjacent days beyond recoverable volume.

**AI progress language rule:** never "You gained exactly 3.72kg of muscle." Always trend-based, hedged language tied to real logged data ("Your weight and strength trend point toward progress on your muscle-gain goal; photos show visible changes in trained regions").

### 7.1 Exercise Visual Demonstrations

Every prescribed exercise should show the user what it looks like, not just its name.

- **Do not AI-generate images/video of exercise form.** An AI-generated image can silently show incorrect form, which is a real injury risk — this is a safety issue, not a style choice.
- Instead, use a **licensed/open exercise media library** (e.g. a dataset like wger's open exercise DB, ExerciseDB, or a licensed stock set) that ships a GIF/short looped video + step-by-step cues per exercise, keyed by an internal `exerciseSlug`.
- The planning engine picks exercises from this media-backed catalog rather than free-text names, so a visual is guaranteed to exist for anything prescribed.
- If an AI-suggested substitution (via the coach chat) isn't in the catalog, fall back to a close catalog match rather than inventing a new unillustrated exercise.
- AI's role here stays language-only: cueing, common-mistake explanations, and "how to modify if X hurts" — the demonstration media itself is always sourced, never generated.

### 7.2 Budget-Based Diet

Budget moves from "optional, nice to have" to a **required nutrition-engine input** with a simple tier selector (e.g. Low / Medium / Flexible, or a per-day/per-week spend estimate):

- Each `Food`/`Recipe` record carries an approximate cost-per-serving field (regional, since food cost varies by market — needs a data source decision in the architecture phase, e.g. a maintained local price table rather than AI-guessed prices).
- The nutrition engine filters/ranks meal and recipe candidates against the user's budget tier before macros are balanced, so the plan never proposes food the user can't reasonably afford.
- AI's role is substitutions within the same budget tier ("swap X for a cheaper local equivalent") — it does not invent prices; unknown costs are shown as "cost estimate unavailable" rather than guessed.

---

## 8. AI Coach

Conversational assistant scoped to the user's real data: current plan, workout/nutrition history, progress, measurements, wearable feed. Handles situational queries ("I only have 30 minutes today," "my knee hurts during squats," "I don't have chicken at home") by pulling live context into the prompt rather than answering generically. Never claims elevated medical authority; escalates to "talk to a professional" language for pain/injury reports.

---

## 9. AI Technology Strategy

**Provider abstraction is mandatory** — no component is hard-wired to one vendor:

```
AIProvider (interface)
├── GroqProvider        (fast, cheap, good for structured JSON tasks)
├── GeminiProvider       (multimodal — image analysis)
├── OpenSourceProvider   (self-hosted fallback for cost control)
└── FallbackProvider     (last-resort degraded response)
```

Each AI component is evaluated independently for: model choice, cost, rate limits, latency, context window, privacy handling, and fallback path. Vision tasks (body/target photo analysis) are evaluated against **specialized CV models** first (pose estimation, image-quality validation) — an LLM vision call is only used where it's genuinely the better tool (e.g., natural-language description of visible changes), not for every image task.

**Structured output discipline:** all AI responses that feed application logic (plan generation, macro targets, safety flags) must return schema-validated JSON (e.g., Zod). Invalid output → retry → constrained repair → fallback → never persisted raw.

---

## 10. Wearable Integration

Normalized health-data layer over legitimate platform APIs only — no scraping or reverse-engineering of private APIs:

```
WearableProvider (interface)
├── AppleHealthProvider
├── HealthConnectProvider   (Android)
├── FitbitProvider
├── GarminProvider
├── SamsungHealthProvider
└── OuraProvider (optional)
```

**Anarc specifically:** needs a verification step before commitment — if no public developer API/SDK exists, this is documented as a known gap; the fallback is manual entry or Health Connect/Apple Health if Anarc syncs into either of those platforms. This should be one of the first architecture-phase research tasks.

Only data actually returned by a given platform is stored — no interpolation to fill gaps.

---

## 11. Data, Privacy & Security Architecture (high level)

- Photos and health data are the most sensitive assets: private object storage, signed upload/download URLs, encryption at rest, strict per-user access control.
- Consent capture at signup and before each new sensitive data category is collected (photos, wearable connection).
- Full export and deletion pathways (user-initiated account/data deletion).
- Audit logging on access to photos and health records.
- Data minimization: don't request or retain fields the product doesn't use.

---

## 12. Proposed Tech Stack (for evaluation, not final)

Given your existing stack familiarity (React Native/Expo, Node.js/TypeScript, PostgreSQL, Prisma, Redis already used across MedCare/ShilpSetu/Wiimo work), the natural default is:

- **Mobile:** React Native + Expo
- **Backend:** Node.js + TypeScript, REST (tRPC optional if mobile+backend stay in one monorepo)
- **DB:** PostgreSQL + Prisma
- **Cache/Queue:** Redis (BullMQ for background jobs)
- **Object storage:** Cloudflare R2 (cheapest egress) vs. S3 vs. Supabase Storage — worth a short cost/feature comparison pass in the architecture phase
- **Background jobs:** dedicated worker process(es) for image analysis, plan generation, wearable sync, notifications — never inline in request/response cycle
- **Push notifications:** Expo push / FCM/APNs

This should be treated as a proposal to validate, not a locked decision — flagged for the architecture phase.

---

## 13. Core Database Entities (naming indicative, not final)

`User, UserProfile, FitnessProfile, Goal, BodyMeasurement, BodyPhoto, TargetPhoto, PhotoAnalysis, ProgressSnapshot, WorkoutPlan, WorkoutDay, Exercise, ExerciseMedia, WorkoutExercise, WorkoutSession, ExerciseSet, CardioSession, NutritionPlan, Meal, Recipe, Food, FoodCostEstimate, WaterLog, WeightLog, MeasurementLog, AIConversation, AIMessage, WearableConnection, WearableDevice, WearableData, SleepRecord, HeartRateRecord, StepRecord, Notification, Reminder, Consent, AuditLog`

Full ERD, Prisma schema, indexes, and constraints are architecture-phase deliverables — not part of this PRD.

---

## 14. High-Level API Surface (indicative)

`POST /auth/register` · `POST /profile` · `POST /body-photos` · `POST /target-photo` · `POST /analysis/start` · `GET /analysis/current` · `POST /plan/generate` · `GET /plan/today` · `GET /workout/today` · `POST /workout/session` · `POST /workout/set` · `GET /nutrition/today` · `POST /water` · `POST /progress` · `POST /progress/photo` · `GET /progress/dashboard` · `POST /wearables/connect` · `POST /wearables/sync` · `POST /ai/chat`

Full method/auth/validation/response/error specs are an architecture-phase deliverable.

---

## 15. AI Pipeline (v1)

```
User Data + Photos + Measurements + History + Goals
→ Validation
→ Image Quality Check (specialized CV)
→ Vision Analysis (labeled Observed/Estimated)
→ Structured User Profile
→ Deterministic Planning Engines (fitness/nutrition/cardio/hydration)
→ Safety Validation Gate
→ AI Explanation Layer (natural-language framing)
→ Schema Validation (Zod) → Persist Plan
→ Daily Execution & Tracking
→ Progress Analysis (deterministic stats + AI trend narrative)
→ Plan Adaptation
```

---

## 16. Open Questions for Next Phase

1. Confirm Anarc's public API availability (blocks or unblocks that integration).
2. Object storage choice — cost comparison needed (R2 vs S3 vs Supabase).
3. Subscription/monetization model — not addressed in this PRD; needed before final DB schema (affects `Subscription` entity).
4. tRPC vs REST — depends on whether mobile and backend share a monorepo.
5. Exact deterministic formulas to lock in for calorie/hydration/volume targets (cite validated sources during architecture phase).

---

## 17. Next Steps

Once this PRD is approved/edited, the next phases are, in order: **(1) Architecture & tech-stack validation → (2) Database schema/ERD → (3) API contracts → (4) AI pipeline implementation → (5) Wearable integration spike → (6) UI/UX flows → (7) Build.**
