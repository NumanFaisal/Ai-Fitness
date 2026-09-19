"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.sql = void 0;
exports.findUserByEmail = findUserByEmail;
exports.createUserAccount = createUserAccount;
exports.ensureUserExists = ensureUserExists;
exports.clearAllDatabaseData = clearAllDatabaseData;
exports.saveUserState = saveUserState;
exports.getUserState = getUserState;
const client_1 = require("@prisma/client");
const postgres_1 = __importDefault(require("postgres"));
// Supabase Direct Postgres Client
const connectionString = process.env.DATABASE_URL || "";
exports.sql = (0, postgres_1.default)(connectionString);
// Global Prisma instance
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const nutritionEngine_1 = require("./engines/nutritionEngine");
const workoutEngine_1 = require("./engines/workoutEngine");
const DATA_DIR = path_1.default.join(__dirname, "..", "data");
const STORE_FILE = path_1.default.join(DATA_DIR, "db_store.json");
function loadStoreFromDisk() {
    try {
        if (fs_1.default.existsSync(STORE_FILE)) {
            const content = fs_1.default.readFileSync(STORE_FILE, "utf-8");
            return JSON.parse(content);
        }
    }
    catch (err) {
        console.warn("Failed to read db_store.json:", err);
    }
    return {};
}
function findUserByEmail(email) {
    const store = loadStoreFromDisk();
    const users = store._users || {};
    return Object.values(users).find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}
function createUserAccount(email, passwordHash, customId) {
    const store = loadStoreFromDisk();
    if (!store._users)
        store._users = {};
    const normalizedEmail = email.toLowerCase().trim();
    // If user with this email already exists in disk store, preserve or update
    const existingKey = Object.keys(store._users).find((k) => store._users[k].email?.toLowerCase() === normalizedEmail);
    const id = customId || (existingKey ? store._users[existingKey].id : `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
    const account = {
        id,
        email: normalizedEmail,
        passwordHash,
        createdAt: existingKey ? store._users[existingKey].createdAt : new Date().toISOString(),
    };
    // Clean up old key if customId changed it
    if (existingKey && existingKey !== id) {
        delete store._users[existingKey];
        if (store[existingKey] && !store[id]) {
            store[id] = store[existingKey];
            delete store[existingKey];
        }
    }
    store._users[id] = account;
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs_1.default.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
    return account;
}
async function ensureUserExists(userId, email) {
    try {
        const existingById = await exports.prisma.user.findUnique({ where: { id: userId } });
        if (existingById)
            return existingById.id;
        if (email) {
            const normalizedEmail = email.toLowerCase().trim();
            const existingByEmail = await exports.prisma.user.findUnique({ where: { email: normalizedEmail } });
            if (existingByEmail)
                return existingByEmail.id;
        }
        const userEmail = (email || `${userId}@fitness.local`).toLowerCase().trim();
        const created = await exports.prisma.user.create({
            data: {
                id: userId,
                email: userEmail,
                passwordHash: "dev-password-hash",
            },
        });
        return created.id;
    }
    catch (err) {
        console.warn("ensureUserExists DB notice:", err?.message || err);
        if (email) {
            try {
                const u = await exports.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
                if (u)
                    return u.id;
            }
            catch { }
        }
        return userId;
    }
}
async function clearAllDatabaseData() {
    try {
        const deleted = await exports.prisma.user.deleteMany({});
        await exports.prisma.workoutExercise.deleteMany({}).catch(() => ({ count: 0 }));
        await exports.prisma.workoutDay.deleteMany({}).catch(() => ({ count: 0 }));
        await exports.prisma.workoutPlan.deleteMany({}).catch(() => ({ count: 0 }));
        await exports.prisma.meal.deleteMany({}).catch(() => ({ count: 0 }));
        await exports.prisma.nutritionPlan.deleteMany({}).catch(() => ({ count: 0 }));
        await exports.prisma.photoAnalysis.deleteMany({}).catch(() => ({ count: 0 }));
        memoryStore.clear();
        if (fs_1.default.existsSync(STORE_FILE)) {
            fs_1.default.writeFileSync(STORE_FILE, JSON.stringify({}, null, 2), "utf-8");
        }
        return { success: true, deletedCount: deleted.count };
    }
    catch (err) {
        console.error("clearAllDatabaseData error:", err);
        throw err;
    }
}
function saveUserState(userId) {
    try {
        if (!fs_1.default.existsSync(DATA_DIR)) {
            fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        }
        const current = loadStoreFromDisk();
        const state = memoryStore.get(userId);
        if (state) {
            current[userId] = {
                profile: state.profile,
                fitnessProfile: state.fitnessProfile,
                goal: state.goal,
                nutritionPlan: state.nutritionPlan,
                workoutPlan: state.workoutPlan,
                waterLogs: state.waterLogs,
                reminders: state.reminders,
                aiPlan: state.aiPlan,
                aiMeals: state.aiMeals,
                hasCompletedOnboarding: state.hasCompletedOnboarding,
                bodyPhotos: state.bodyPhotos,
            };
            fs_1.default.writeFileSync(STORE_FILE, JSON.stringify(current, null, 2), "utf-8");
        }
    }
    catch (err) {
        console.warn("Failed to persist user state to disk:", err);
    }
}
const memoryStore = new Map();
function getUserState(userId) {
    if (!memoryStore.has(userId)) {
        // 1. Try loading from persistent disk database
        const diskData = loadStoreFromDisk();
        if (diskData[userId]) {
            const saved = diskData[userId];
            memoryStore.set(userId, {
                profile: saved.profile,
                fitnessProfile: saved.fitnessProfile,
                goal: saved.goal,
                nutritionPlan: saved.nutritionPlan,
                workoutPlan: saved.workoutPlan,
                waterLogs: saved.waterLogs || [],
                jobs: new Map(),
                hasCompletedOnboarding: Boolean(saved.hasCompletedOnboarding),
                bodyPhotos: saved.bodyPhotos,
            });
            const st = memoryStore.get(userId);
            if (saved.reminders)
                st.reminders = saved.reminders;
            if (saved.aiPlan)
                st.aiPlan = saved.aiPlan;
            if (saved.aiMeals)
                st.aiMeals = saved.aiMeals;
        }
        else {
            // 2. Initialize default profile and engines
            const defaultProfile = {
                name: "Athlete",
                age: 25,
                sex: "MALE",
                heightCm: 178,
                weightKg: 75,
            };
            const defaultFitness = {
                experienceLevel: "BEGINNER",
                trainingEnvironment: "GYM",
                equipmentAvailable: ["barbell", "dumbbell", "cables", "bench", "pullup_bar"],
                workoutDaysPerWeek: 4,
                sessionDurationMin: 45,
                injuries: [],
                physicalLimitations: [],
                dietaryPreference: "High Protein / Balanced",
                allergies: [],
                dislikedFoods: [],
                cuisinePreferences: ["mediterranean", "healthy"],
                budgetTier: "MEDIUM",
                targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            };
            const defaultGoal = {
                type: "MUSCLE_GAIN",
                isPrimary: true,
            };
            const nutrition = (0, nutritionEngine_1.calculateNutrition)({
                weightKg: defaultProfile.weightKg || 75,
                heightCm: defaultProfile.heightCm || 178,
                age: defaultProfile.age || 25,
                sex: defaultProfile.sex || "MALE",
                workoutDaysPerWeek: defaultFitness.workoutDaysPerWeek || 4,
                goal: defaultGoal.type || "MUSCLE_GAIN",
                budgetTier: defaultFitness.budgetTier || "MEDIUM",
            });
            const workout = (0, workoutEngine_1.generateWorkoutPlan)({
                experienceLevel: defaultFitness.experienceLevel || "BEGINNER",
                trainingEnvironment: defaultFitness.trainingEnvironment || "GYM",
                equipmentAvailable: defaultFitness.equipmentAvailable || ["barbell", "dumbbell"],
                workoutDaysPerWeek: defaultFitness.workoutDaysPerWeek || 4,
                sessionDurationMin: defaultFitness.sessionDurationMin || 45,
                injuries: defaultFitness.injuries || [],
                goal: defaultGoal.type || "MUSCLE_GAIN",
            });
            memoryStore.set(userId, {
                profile: defaultProfile,
                fitnessProfile: defaultFitness,
                goal: defaultGoal,
                nutritionPlan: nutrition,
                workoutPlan: workout,
                waterLogs: [],
                jobs: new Map(),
                hasCompletedOnboarding: false,
            });
            saveUserState(userId);
        }
    }
    const state = memoryStore.get(userId);
    // Guarantee plans exist even if profile was partially populated
    if (!state.nutritionPlan && state.profile) {
        state.nutritionPlan = (0, nutritionEngine_1.calculateNutrition)({
            weightKg: state.profile.weightKg || 75,
            heightCm: state.profile.heightCm || 178,
            age: state.profile.age || 25,
            sex: state.profile.sex || "MALE",
            workoutDaysPerWeek: state.fitnessProfile?.workoutDaysPerWeek || 4,
            goal: state.goal?.type || "MUSCLE_GAIN",
            budgetTier: state.fitnessProfile?.budgetTier || "MEDIUM",
        });
        saveUserState(userId);
    }
    if (!state.workoutPlan && state.fitnessProfile) {
        state.workoutPlan = (0, workoutEngine_1.generateWorkoutPlan)({
            experienceLevel: state.fitnessProfile.experienceLevel || "BEGINNER",
            trainingEnvironment: state.fitnessProfile.trainingEnvironment || "GYM",
            equipmentAvailable: state.fitnessProfile.equipmentAvailable || ["barbell", "dumbbell"],
            workoutDaysPerWeek: state.fitnessProfile.workoutDaysPerWeek || 4,
            sessionDurationMin: state.fitnessProfile.sessionDurationMin || 45,
            injuries: state.fitnessProfile.injuries || [],
            goal: state.goal?.type || "MUSCLE_GAIN",
        });
        saveUserState(userId);
    }
    return state;
}
