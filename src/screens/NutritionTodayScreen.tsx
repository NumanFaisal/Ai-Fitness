import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/store/ThemeContext";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { endpoints } from "@/api/endpoints";
import type { NutritionPlanToday, Meal } from "@/types/models";

export function NutritionTodayScreen() {
  const { colors } = useTheme();
  const [plan, setPlan] = useState<NutritionPlanToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(0);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        let res = await endpoints.getTodayNutrition();
        if (!res) {
          try { await endpoints.generatePlan(); res = await endpoints.getTodayNutrition(); } catch {}
        }
        setPlan(res);
      } catch { setPlan(null); }
      finally { setLoading(false); }
    }
    fetch();
  }, []);

  function openRecipe(meal: Meal) {
    const url = meal.youtubeUrl || `https://www.youtube.com/results?search_query=how+to+make+${encodeURIComponent(meal.recipeTitle || meal.mealSlot)}+recipe`;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Nutrition</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Daily balanced diet with step-by-step preparation</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 40 }} />
      ) : !plan ? (
        <EmptyState title="No nutrition plan yet" description="Meals and recipes will appear here once your plan is generated." />
      ) : (
        <>
          {/* Macro Targets */}
          <View style={styles.macroRow}>
            <GlassCard strong style={styles.macroCard}>
              <Text style={[styles.macroVal, { color: colors.textPrimary }]}>{plan.calorieTarget.value}</Text>
              <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>kcal Target</Text>
              <ProvenanceBadge provenance={plan.calorieTarget.provenance} confidence={plan.calorieTarget.confidence} />
            </GlassCard>
            <GlassCard strong style={styles.macroCard}>
              <Text style={[styles.macroVal, { color: colors.accent }]}>{plan.proteinTargetG.value}<Text style={{ fontSize: 18 }}>g</Text></Text>
              <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Daily Protein</Text>
              <ProvenanceBadge provenance={plan.proteinTargetG.provenance} confidence={plan.proteinTargetG.confidence} />
            </GlassCard>
          </View>

          {/* Meal Cards */}
          {plan.meals.length === 0 ? (
            <EmptyState title="No meals planned" description="Check back after your next plan update." />
          ) : (
            plan.meals.map((meal, i) => {
              const isOpen = expandedMeal === i;
              return (
                <GlassCard key={i} style={styles.mealCard}>
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setExpandedMeal(isOpen ? null : i)}>
                    <View style={styles.mealHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.slotRow}>
                          <Text style={[styles.mealSlot, { color: colors.accent }]}>{meal.mealSlot}</Text>
                          {meal.calories && (
                            <Text style={[styles.mealMacros, { color: colors.textSecondary }]}>
                              {meal.calories.value} kcal{meal.proteinG ? ` · ${meal.proteinG.value}g protein` : ""}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.mealTitle, { color: colors.textPrimary }]}>
                          {meal.recipeTitle || `${meal.mealSlot} Recipe`}
                        </Text>
                      </View>
                      <Text style={[styles.chevron, { color: colors.textTertiary }]}>{isOpen ? "▲" : "▼"}</Text>
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={[styles.recipeBody, { borderTopColor: colors.glassBorder }]}>
                      {meal.ingredients && meal.ingredients.length > 0 && (
                        <View style={{ gap: 4 }}>
                          <Text style={[styles.recipeHeading, { color: colors.textPrimary }]}>Ingredients</Text>
                          {meal.ingredients.map((ing, idx) => (
                            <Text key={idx} style={[styles.recipeItem, { color: colors.textSecondary }]}>• {ing}</Text>
                          ))}
                        </View>
                      )}
                      {meal.instructions && meal.instructions.length > 0 && (
                        <View style={{ gap: 4 }}>
                          <Text style={[styles.recipeHeading, { color: colors.textPrimary }]}>Instructions</Text>
                          {meal.instructions.map((step, idx) => (
                            <Text key={idx} style={[styles.recipeItem, { color: colors.textSecondary }]}>{idx + 1}. {step}</Text>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity onPress={() => openRecipe(meal)}>
                        <Text style={[styles.watchBtn, { color: colors.accent }]}>▶ Watch Recipe on YouTube</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </GlassCard>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: Platform.OS === "ios" ? 60 : 48, gap: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle: { fontSize: 15, letterSpacing: -0.2, marginTop: 2, marginBottom: 4 },
  macroRow: { flexDirection: "row", gap: 12 },
  macroCard: { flex: 1, gap: 4 },
  macroVal: { fontSize: 32, fontWeight: "700", letterSpacing: -0.5 },
  macroLabel: { fontSize: 13 },
  mealCard: { gap: 10 },
  mealHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  mealSlot: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  mealMacros: { fontSize: 12, fontWeight: "500" },
  mealTitle: { fontSize: 16, fontWeight: "600", letterSpacing: -0.3 },
  chevron: { fontSize: 12, paddingLeft: 8 },
  recipeBody: { gap: 12, paddingTop: 12, borderTopWidth: 0.5 },
  recipeHeading: { fontSize: 14, fontWeight: "600" },
  recipeItem: { fontSize: 13, lineHeight: 19 },
  watchBtn: { fontSize: 13, fontWeight: "500", marginTop: 4 },
});
