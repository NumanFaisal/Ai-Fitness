# AI-Powered Fitness & Body-Transformation App

A mobile-first application that acts as an intelligent, data-honest personal fitness coach: personalized training, nutrition, cardio, and hydration plans generated from a user's real profile, photos, and (optionally) wearable data — adapted over time from actually-logged progress.

> Full product spec: [`docs/PRD.md`](docs/PRD.md) (if included in this handoff) · Build order: [`docs/WORKFLOW.md`](docs/WORKFLOW.md) · Schema: [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) · AI agent rules: [`docs/AI_GUIDELINES.md`](docs/AI_GUIDELINES.md) · Domain context: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)

---

## Core Principles

These are non-negotiable and every PR / AI-generated change should be checked against them:

1. **No dummy data.** Nothing fake, seeded, or hardcoded ships to production. If data doesn't exist, the UI shows an empty state with a clear call to action — never an invented number.
2. **AI explains; it doesn't calculate or diagnose.** BMI, calorie/hydration targets, training volume, and progress stats are deterministic. AI handles personalization, natural-language coaching, recipe generation, and photo interpretation — always schema-validated before it's persisted.
3. **Every value has a provenance tag.** `user_provided | calculated | wearable | observed | estimated`. This is enforced at the data layer, not just the UI.
4. **Safety first.** No diagnosis, no extreme-deficit or extreme-volume plans, no promise that a target photo is achievable as-is. Injury/health flags gate auto-generation and route to a "consult a professional" state instead.

---

## Tech Stack (proposed — see `docs/WORKFLOW.md` for validation status)

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo |
| Backend | Node.js + TypeScript, REST |
| Database | PostgreSQL + Prisma |
| Cache / Queue | Redis + BullMQ |
| Object storage | Cloudinary (Free tier, media uploads & transformations) |
| AI | Provider-abstracted (Groq / Gemini / open-source / fallback) |
| Wearables | Normalized provider layer (Apple Health, Health Connect, Fitbit, Garmin, ...) |
| Push | Expo push / FCM / APNs |

---

## Repository Structure (proposed)

```
/apps
  /mobile              # React Native + Expo app
  /api                 # Node.js + TypeScript backend (REST)
  /worker              # Background job processors (BullMQ)
/packages
  /db                  # Prisma schema + generated client
  /ai-providers         # AIProvider abstraction (Groq, Gemini, OpenSource, Fallback)
  /wearable-providers   # WearableProvider abstraction
  /shared-types         # Zod schemas + shared TS types (source of truth for AI output contracts)
/docs
  PRD.md
  WORKFLOW.md
  DATABASE_SCHEMA.md
  PROJECT_CONTEXT.md
  AI_GUIDELINES.md
```

---

## Getting Started

> These steps assume the repo has been scaffolded per the structure above. Nothing is scaffolded yet — this README describes the target state for whoever (human or AI agent) does the initial setup.

### Prerequisites
- Node.js 20+
- pnpm (or npm/yarn — pick one and stay consistent repo-wide)
- Docker (for local Postgres + Redis)
- Expo CLI (`npx expo`)

### 1. Clone & install
```bash
git clone <repo-url>
cd fitness-transformation-app
pnpm install
```

### 2. Start local infra
```bash
docker compose up -d   # Postgres + Redis
```

### 3. Environment variables
Copy `.env.example` → `.env` in `/apps/api` and `/apps/worker`. Minimum required:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/fitness_app
REDIS_URL=redis://localhost:6379

# Object storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# AI providers (only configure what you're using)
GROQ_API_KEY=
GEMINI_API_KEY=

# Auth
JWT_SECRET=

# Push
EXPO_ACCESS_TOKEN=
```

### 4. Run database migrations
```bash
pnpm --filter @app/db prisma migrate dev
```

### 5. Start services
```bash
pnpm --filter @app/api dev        # backend
pnpm --filter @app/worker dev     # background jobs
pnpm --filter @app/mobile start   # Expo dev server
```

---

## Key Workflows

- **Plan generation** is async: request → queue → worker (deterministic engines + AI explanation layer) → schema-validated persist → push notification. Never generated inline in the request/response cycle. Full detail: `docs/WORKFLOW.md`.
- **Any AI output that feeds app logic** must pass through a Zod schema before it's stored. Invalid output → retry → constrained repair → fallback → never persisted raw.
- **Adding a new AI or wearable provider** means implementing the shared interface in `/packages/ai-providers` or `/packages/wearable-providers` — nothing else in the codebase should reference a specific vendor directly.

---

## Status

Currently at the **documentation / pre-implementation** phase: PRD approved, this doc set defines schema and workflow ahead of scaffolding. Next step is repo scaffolding + Prisma migration from `docs/DATABASE_SCHEMA.md`.
