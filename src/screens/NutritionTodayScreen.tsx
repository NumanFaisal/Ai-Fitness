import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { EmptyState } from "@/components/EmptyState";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { endpoints } from "@/api/endpoints";
import type { NutritionPlanToday, Meal } from "@/types/models";

export function NutritionTodayScreen() {
  const [plan, setPlan] = useState<NutritionPlanToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(0); // first meal open by default

  useEffect(() => {
    async function fetchNutrition() {
      setLoading(true);
      try {
        let res = await endpoints.getTodayNutrition();
        if (!res) {
          try {
            await endpoints.generatePlan();
            res = await endpoints.getTodayNutrition();
          } catch {
            // Ignore
          }
        }
        setPlan(res);
      } catch {
        setPlan(null);
      } finally {
        setLoading(false);
      }
    }
    fetchNutrition();
  }, []);

  function openYouTubeRecipe(meal: Meal) {
    const url =
      meal.youtubeUrl ||
      `https://www.youtube.com/results?search_query=how+to+make+${encodeURIComponent(meal.recipeTitle || meal.mealSlot)}+recipe`;
    Linking.openURL(url).catch((err) => console.warn("Failed to open YouTube:", err));
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 16 }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition & Recipes</Text>
        <Text style={styles.subtitle}>Daily balanced diet with step-by-step preparation and video guides</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 40 }} />
      ) : !plan ? (
        <EmptyState
          title="No nutrition plan yet"
          description="Meals and recipes will appear here once your plan is generated."
        />
      ) : (
        <>
          {/* Daily Targets Row */}
          <View style={styles.targetsRow}>
            <View style={styles.targetCard}>
              <Text style={styles.targetValue}>{plan.calorieTarget.value}</Text>
              <Text style={styles.targetLabel}>kcal Target</Text>
              <ProvenanceBadge provenance={plan.calorieTarget.provenance} confidence={plan.calorieTarget.confidence} />
            </View>
            <View style={styles.targetCard}>
              <Text style={styles.targetValue}>{plan.proteinTargetG.value}g</Text>
              <Text style={styles.targetLabel}>Daily Protein</Text>
              <ProvenanceBadge provenance={plan.proteinTargetG.provenance} confidence={plan.proteinTargetG.confidence} />
            </View>
          </View>

          {plan.meals.length === 0 ? (
            <EmptyState title="No meals planned for today" description="Check back after your next plan update." />
          ) : (
            plan.meals.map((meal, i) => {
              const isExpanded = expandedMeal === i;
              return (
                <View key={i} style={styles.mealCard}>
                  {/* Meal Slot Header */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.mealHeader}
                    onPress={() => setExpandedMeal(isExpanded ? null : i)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.slotBadgeContainer}>
                        <Text style={styles.mealSlot}>{meal.mealSlot}</Text>
                        {meal.calories && (
                          <Text style={styles.mealMeta}>
                            {meal.calories.value} kcal · {meal.proteinG ? `${meal.proteinG.value}g protein` : ""}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.mealTitle}>
                        {meal.recipeTitle || `${meal.mealSlot} Recipe`}
                      </Text>
                    </View>
                    <Text style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</Text>
                  </TouchableOpacity>

                  {/* Expandable Recipe Details */}
                  {isExpanded && (
                    <View style={styles.recipeBody}>
                      {/* Ingredients List */}
                      {meal.ingredients && meal.ingredients.length > 0 && (
                        <View style={styles.recipeSection}>
                          <Text style={styles.sectionHeader}>Ingredients:</Text>
                          {meal.ingredients.map((ing, idx) => (
                            <Text key={idx} style={styles.ingredientItem}>
                              • {ing}
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* Preparation Steps */}
                      {meal.instructions && meal.instructions.length > 0 && (
                        <View style={styles.recipeSection}>
                          <Text style={styles.sectionHeader}>Instructions:</Text>
                          {meal.instructions.map((step, idx) => (
                            <Text key={idx} style={styles.stepItem}>
                              {idx + 1}. {step}
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* YouTube Recipe Button */}
                      <TouchableOpacity
                        style={styles.youtubeBtn}
                        activeOpacity={0.8}
                        onPress={() => openYouTubeRecipe(meal)}
                      >
                        <Text style={styles.youtubePlayIcon}>▶</Text>
                        <Text style={styles.youtubeBtnText}>Watch Recipe on YouTube</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { gap: 4 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  targetsRow: { flexDirection: "row", gap: 12 },
  targetCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetValue: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  targetLabel: { color: colors.textSecondary, fontSize: 12 },
  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  mealSlot: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  mealTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  mealMeta: { color: colors.textMuted, fontSize: 12 },
  expandIcon: { color: colors.textMuted, fontSize: 14, paddingLeft: 8 },
  recipeBody: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  recipeSection: { gap: 6 },
  sectionHeader: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
  ingredientItem: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  stepItem: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  youtubeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DC2626", // YouTube red
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  youtubePlayIcon: { color: "#FFFFFF", fontSize: 12 },
  youtubeBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
