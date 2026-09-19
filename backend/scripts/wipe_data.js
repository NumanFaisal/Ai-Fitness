const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to Supabase...');
  
  // Count current records
  const userCount = await prisma.user.count();
  const profileCount = await prisma.userProfile.count();
  const fitnessCount = await prisma.fitnessProfile.count();
  const goalCount = await prisma.goal.count();
  const weightCount = await prisma.weightLog.count();
  const waterCount = await prisma.waterLog.count();
  const workoutPlanCount = await prisma.workoutPlan.count();
  const workoutDayCount = await prisma.workoutDay.count();
  const workoutExerciseCount = await prisma.workoutExercise.count();
  const nutritionPlanCount = await prisma.nutritionPlan.count();
  const photoCount = await prisma.bodyPhoto.count();
  const targetPhotoCount = await prisma.targetPhoto.count();

  console.log('Current Supabase Data:', {
    users: userCount,
    profiles: profileCount,
    fitnessProfiles: fitnessCount,
    goals: goalCount,
    weightLogs: weightCount,
    waterLogs: waterCount,
    workoutPlans: workoutPlanCount,
    workoutDays: workoutDayCount,
    workoutExercises: workoutExerciseCount,
    nutritionPlans: nutritionPlanCount,
    bodyPhotos: photoCount,
    targetPhotos: targetPhotoCount,
  });

  console.log('\n--- Wiping all data from Supabase ---');

  // Deleting users cascades to user_profiles, fitness_profiles, goals, body_measurements,
  // body_photos, target_photos, progress_snapshots, workout_plans, nutrition_plans,
  // workout_sessions, cardio_sessions, water_logs, weight_logs, measurement_logs,
  // ai_conversations, wearable_connections, wearable_data, notifications, reminders, consents, audit_logs
  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`Deleted ${deletedUsers.count} users (and all cascaded relations).`);

  // Also clean up any orphan records if any exist
  const deletedExercises = await prisma.workoutExercise.deleteMany({}).catch(() => ({ count: 0 }));
  const deletedDays = await prisma.workoutDay.deleteMany({}).catch(() => ({ count: 0 }));
  const deletedPlans = await prisma.workoutPlan.deleteMany({}).catch(() => ({ count: 0 }));
  const deletedMeals = await prisma.meal.deleteMany({}).catch(() => ({ count: 0 }));
  const deletedNutr = await prisma.nutritionPlan.deleteMany({}).catch(() => ({ count: 0 }));
  const deletedPhotos = await prisma.photoAnalysis.deleteMany({}).catch(() => ({ count: 0 }));

  // Verify all are 0
  const remainingUsers = await prisma.user.count();
  console.log('Remaining users in Supabase:', remainingUsers);

  // Clear local db_store.json to start completely fresh
  const storePath = path.join(__dirname, '..', 'data', 'db_store.json');
  if (fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({}, null, 2), 'utf-8');
    console.log('Cleared local db_store.json');
  }

  console.log('All Supabase and local data wiped successfully!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error during wipe:', e);
  process.exit(1);
});
