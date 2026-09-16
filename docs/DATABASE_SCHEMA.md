# Database Schema

PostgreSQL via Prisma. This is a design-phase schema — meant to be dropped into `/packages/db/schema.prisma` and refined during implementation, not treated as final/frozen. Field names are illustrative; enforce naming consistency (camelCase in Prisma → snake_case in DB via `@map`) once implementation starts.

**Cross-cutting rule:** any field that could be confused for a measured fact must carry (or be joinable to) a `provenance` value: `USER_PROVIDED | CALCULATED | WEARABLE | OBSERVED | ESTIMATED`. See `DataProvenance` enum below.

---

## Enums

```prisma
enum DataProvenance {
  USER_PROVIDED
  CALCULATED
  WEARABLE
  OBSERVED
  ESTIMATED
}

enum Sex {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum ExperienceLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum FitnessGoal {
  FAT_LOSS
  MUSCLE_GAIN
  RECOMPOSITION
  STRENGTH
  ENDURANCE
  GENERAL_FITNESS
  ATHLETIC_PERFORMANCE
  MAINTENANCE
}

enum BudgetTier {
  LOW
  MEDIUM
  FLEXIBLE
}

enum TrainingEnvironment {
  GYM
  HOME
  OUTDOOR
}

enum PhotoAngle {
  FRONT
  BACK
  LEFT
  RIGHT
}

enum PlanStatus {
  PENDING
  ACTIVE
  ADAPTED
  ARCHIVED
}

enum JobStatus {
  QUEUED
  PROCESSING
  COMPLETE
  FAILED
}
```

---

## Core User & Profile

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?        // soft delete — never hard-delete a user with historical health data without explicit export+consent flow

  profile           UserProfile?
  fitnessProfile    FitnessProfile?
  goals             Goal[]
  bodyMeasurements  BodyMeasurement[]
  bodyPhotos        BodyPhoto[]
  targetPhotos      TargetPhoto[]
  progressSnapshots ProgressSnapshot[]
  workoutPlans      WorkoutPlan[]
  nutritionPlans    NutritionPlan[]
  waterLogs         WaterLog[]
  weightLogs        WeightLog[]
  measurementLogs   MeasurementLog[]
  aiConversations   AIConversation[]
  wearableConnections WearableConnection[]
  notifications     Notification[]
  reminders         Reminder[]
  consents          Consent[]
  auditLogs         AuditLog[]

  @@index([email])
}

model UserProfile {
  id                  String   @id @default(uuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id])
  name                String
  age                 Int
  sex                 Sex
  heightCm            Float
  occupationActivity  String?
  sleepScheduleNote   String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model FitnessProfile {
  id                    String   @id @default(uuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id])
  experienceLevel       ExperienceLevel
  trainingEnvironment   TrainingEnvironment
  equipmentAvailable    String[]      // e.g. ["barbell","dumbbell","bands"]
  workoutDaysPerWeek    Int
  sessionDurationMin    Int
  injuries              String[]
  physicalLimitations   String[]
  dietaryPreference     String        // vegetarian / vegan / omnivore / etc.
  allergies             String[]
  dislikedFoods         String[]
  cuisinePreferences    String[]
  mealsPerDay           Int?
  cookingAbility        String?       // beginner / intermediate / advanced
  budgetTier            BudgetTier
  targetDate            DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model Goal {
  id          String       @id @default(uuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id])
  type        FitnessGoal
  isPrimary   Boolean      @default(true)
  createdAt   DateTime     @default(now())

  @@index([userId])
}
```

---

## Photos & Analysis

```prisma
model BodyPhoto {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id])
  angle       PhotoAngle
  storageKey  String     // R2 object key, never a public URL
  takenAt     DateTime   @default(now())
  isProgress  Boolean    @default(false)  // false = onboarding baseline, true = later progress photo
  analysis    PhotoAnalysis?

  @@index([userId, takenAt])
}

model TargetPhoto {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  storageKey  String
  uploadedAt  DateTime @default(now())
  analysis    PhotoAnalysis?
}

model PhotoAnalysis {
  id             String          @id @default(uuid())
  bodyPhotoId    String?         @unique
  bodyPhoto      BodyPhoto?      @relation(fields: [bodyPhotoId], references: [id])
  targetPhotoId  String?         @unique
  targetPhoto    TargetPhoto?    @relation(fields: [targetPhotoId], references: [id])
  observedNotes  String?         // provenance: OBSERVED
  estimatedData  Json?           // provenance: ESTIMATED — always store confidence alongside value
  confidence     Float?          // 0-1, required if estimatedData is set
  modelUsed      String          // which CV/AI model produced this
  createdAt      DateTime        @default(now())
}

model ProgressSnapshot {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  snapshotDate   DateTime @default(now())
  weightKg       Float?
  measurements   Json?         // keyed measurement snapshot, provenance: CALCULATED/USER_PROVIDED
  aiNarrative    String?       // hedged trend language only, never precise composition claims
  createdAt      DateTime @default(now())

  @@index([userId, snapshotDate])
}
```

---

## Training

```prisma
model Exercise {
  id             String   @id @default(uuid())
  name           String   @unique
  slug           String   @unique
  primaryMuscle  String
  secondaryMuscles String[]
  equipmentNeeded String[]
  instructions   String
  media          ExerciseMedia?
  createdAt      DateTime @default(now())
}

model ExerciseMedia {
  id           String   @id @default(uuid())
  exerciseId   String   @unique
  exercise     Exercise @relation(fields: [exerciseId], references: [id])
  mediaType    String   // "gif" | "video"
  storageKey   String
  sourceLicense String  // required — never AI-generated, must cite the licensed/open dataset
  createdAt    DateTime @default(now())
}

model WorkoutPlan {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id])
  status      PlanStatus @default(PENDING)
  startDate   DateTime
  endDate     DateTime?
  generatedBy String     // engine version identifier
  days        WorkoutDay[]
  createdAt   DateTime   @default(now())

  @@index([userId, status])
}

model WorkoutDay {
  id            String        @id @default(uuid())
  workoutPlanId String
  workoutPlan   WorkoutPlan   @relation(fields: [workoutPlanId], references: [id])
  dayOfWeek     Int           // 0-6
  focus         String        // e.g. "Push", "Legs"
  exercises     WorkoutExercise[]
}

model WorkoutExercise {
  id            String       @id @default(uuid())
  workoutDayId  String
  workoutDay    WorkoutDay   @relation(fields: [workoutDayId], references: [id])
  exerciseId    String
  exercise      Exercise     @relation(fields: [exerciseId], references: [id])
  sets          Int
  repRangeLow   Int
  repRangeHigh  Int
  restSeconds   Int
  rpeTarget     Float?
  orderIndex    Int
}

model WorkoutSession {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  workoutDayId  String?
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  sets          ExerciseSet[]

  @@index([userId, startedAt])
}

model ExerciseSet {
  id                String         @id @default(uuid())
  workoutSessionId  String
  workoutSession    WorkoutSession @relation(fields: [workoutSessionId], references: [id])
  exerciseId        String
  exercise          Exercise       @relation(fields: [exerciseId], references: [id])
  setNumber         Int
  reps              Int
  weightKg          Float?
  rpe               Float?
  completedAt       DateTime       @default(now())
}

model CardioSession {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  activityType  String   // treadmill / running / cycling / etc.
  durationMin   Int
  distanceKm    Float?
  avgHeartRate  Int?         // provenance: WEARABLE if synced, USER_PROVIDED if manual
  provenance    DataProvenance
  completedAt   DateTime @default(now())

  @@index([userId, completedAt])
}
```

---

## Nutrition

```prisma
model Food {
  id                String   @id @default(uuid())
  name              String
  caloriesPer100g   Float
  proteinPer100g    Float
  carbsPer100g      Float
  fatPer100g        Float
  fiberPer100g      Float?
  dataSource        String   // e.g. "USDA FoodData Central" — never AI-guessed
  costEstimate      FoodCostEstimate?
}

model FoodCostEstimate {
  id           String   @id @default(uuid())
  foodId       String   @unique
  food         Food     @relation(fields: [foodId], references: [id])
  region       String   // pricing varies by market
  costPerServing Float
  currency     String
  sourceNote   String   // where the price estimate came from
  updatedAt    DateTime @updatedAt
}

model Recipe {
  id            String   @id @default(uuid())
  title         String
  ingredients   Json     // [{foodId, quantity, unit}]
  steps         String[]
  prepTimeMin   Int
  servings      Int
  budgetTier    BudgetTier
  meals         Meal[]
}

model NutritionPlan {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id])
  status      PlanStatus @default(PENDING)
  calorieTarget Int      // provenance: CALCULATED
  proteinTargetG Int
  carbTargetG    Int
  fatTargetG     Int
  startDate   DateTime
  meals       Meal[]
  createdAt   DateTime   @default(now())

  @@index([userId, status])
}

model Meal {
  id                String        @id @default(uuid())
  nutritionPlanId   String
  nutritionPlan     NutritionPlan @relation(fields: [nutritionPlanId], references: [id])
  recipeId          String?
  recipe            Recipe?       @relation(fields: [recipeId], references: [id])
  mealSlot          String        // breakfast / lunch / dinner / snack / post-workout
  dayOfWeek         Int
}
```

---

## Tracking Logs

```prisma
model WaterLog {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  amountMl  Int
  loggedAt  DateTime @default(now())

  @@index([userId, loggedAt])
}

model WeightLog {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  weightKg  Float
  loggedAt  DateTime @default(now())

  @@index([userId, loggedAt])
}

model MeasurementLog {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  measurements Json     // {waistCm, chestCm, armsCm, hipsCm, thighsCm, ...}
  loggedAt     DateTime @default(now())

  @@index([userId, loggedAt])
}
```

---

## AI Coach

```prisma
model AIConversation {
  id         String     @id @default(uuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id])
  startedAt  DateTime   @default(now())
  messages   AIMessage[]
}

model AIMessage {
  id               String         @id @default(uuid())
  conversationId   String
  conversation     AIConversation @relation(fields: [conversationId], references: [id])
  role             String         // "user" | "assistant"
  content          String
  contextSnapshot  Json?          // what user data was in context for this response — for auditability
  createdAt        DateTime       @default(now())
}
```

---

## Wearables

```prisma
model WearableConnection {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  provider      String   // "apple_health" | "health_connect" | "fitbit" | "garmin" | ...
  accessToken   String?  // encrypted at rest
  refreshToken  String?  // encrypted at rest
  connectedAt   DateTime @default(now())
  lastSyncAt    DateTime?
  isActive      Boolean  @default(true)

  @@index([userId])
}

model WearableDevice {
  id            String   @id @default(uuid())
  connectionId  String
  deviceName    String
  deviceModel   String?
}

model WearableData {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  provider      String
  metricType    String   // "steps" | "heart_rate" | "sleep" | "active_calories" | ...
  value         Float
  unit          String
  recordedAt    DateTime
  syncedAt      DateTime @default(now())

  @@index([userId, metricType, recordedAt])
}

model SleepRecord {
  id           String   @id @default(uuid())
  userId       String
  startTime    DateTime
  endTime      DateTime
  quality      String?
  provenance   DataProvenance @default(WEARABLE)
}

model HeartRateRecord {
  id          String   @id @default(uuid())
  userId      String
  bpm         Int
  recordedAt  DateTime
  context     String?  // resting / active / workout
}

model StepRecord {
  id        String   @id @default(uuid())
  userId    String
  steps     Int
  date      DateTime
}
```

---

## System

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String
  title     String
  body      String
  sentAt    DateTime?
  readAt    DateTime?
  createdAt DateTime @default(now())
}

model Reminder {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  type       String   // "water" | "workout" | "progress_photo" | ...
  scheduleCron String
  isActive   Boolean  @default(true)
}

model Consent {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  scope       String   // "photos" | "wearable_data" | "marketing" | ...
  grantedAt   DateTime @default(now())
  revokedAt   DateTime?
}

model AuditLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  action      String   // "photo_viewed" | "data_exported" | "account_deleted" | ...
  actorId     String?  // who performed the action, if not the user themself
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
}

model BackgroundJob {
  id         String    @id @default(uuid())
  type       String    // "plan_generation" | "photo_analysis" | "wearable_sync" | ...
  status     JobStatus @default(QUEUED)
  payload    Json
  result     Json?
  error      String?
  createdAt  DateTime  @default(now())
  completedAt DateTime?
}
```

---

## Notes for Implementation

- Every `Json` field storing AI or CV output must have been schema-validated (Zod) **before** it reaches Prisma — the DB schema does not enforce that shape, the application layer does.
- `storageKey` fields (photos, exercise media) are private object keys, never public URLs — access goes through a signed-URL endpoint that checks ownership.
- Soft-delete (`deletedAt`) is required on `User` at minimum; extend to other health-sensitive tables if the retention policy requires it (decide during Phase 2 architecture review, see `docs/WORKFLOW.md`).
- Add composite indexes as query patterns emerge during implementation — the ones above are a starting point, not exhaustive.
