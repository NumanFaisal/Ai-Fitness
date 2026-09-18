import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/store/ThemeContext";
import { GlassCard } from "@/components/GlassCard";
import { endpoints } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import type { AIChatMessage } from "@/types/models";

const QUICK_ACTIONS = [
  { label: "+500ml Water", prompt: "Log 500ml of water into my tracker" },
  { label: "-150 kcal", prompt: "Reduce my daily calorie target by 150 kcal" },
  { label: "Swap Lunch", prompt: "Swap my lunch for an alternate high protein recipe" },
  { label: "Audit Protocol", prompt: "Analyze my whole app progress and compliance" },
];

export function AICoachScreen() {
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      role: "assistant",
      content: "Welcome to your performance protocol. I oversee your training volume, hydration, and nutritional budget in real time. Tell me how you are performing today, or let me know if you need to adjust calories, log hydration, or modify a meal.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [latestVitals, setLatestVitals] = useState<AIChatMessage["appVitals"] | null>(null);
  const listRef = useRef<FlatList>(null);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || sending) return;
    const userMsg: AIChatMessage = { role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setSending(true);
    try {
      const response = await endpoints.sendCoachMessage(text);
      setMessages((prev) => [...prev, response]);
      if (response.appVitals) setLatestVitals(response.appVitals);
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Couldn't reach coach. Try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: msg, createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  }

  const inputBg = isDark ? "rgba(28,28,30,0.95)" : "rgba(255,255,255,0.95)";
  const chipBg = isDark ? "rgba(44,44,46,0.75)" : "rgba(229,229,234,0.85)";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 60 : 48 }]}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>AI Coach</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Adaptive Protocol & Telemetry</Text>
        </View>
        <View style={[styles.activeBadge, { backgroundColor: colors.successMuted }]}>
          <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.activeText, { color: colors.success }]}>Active</Text>
        </View>
      </View>

      {/* Live Vitals */}
      {latestVitals && (
        <GlassCard strong style={styles.vitalsCard}>
          {[
            { label: "Daily Target", val: `${latestVitals.calorieTarget} kcal` },
            { label: "Hydration", val: `${latestVitals.waterConsumedMl}/${latestVitals.waterTargetMl}ml` },
            { label: "Weight", val: `${latestVitals.weightKg} kg` },
          ].map((v, i, arr) => (
            <React.Fragment key={v.label}>
              <View style={styles.vitalItem}>
                <Text style={[styles.vitalVal, { color: colors.textPrimary }]}>{v.val}</Text>
                <Text style={[styles.vitalLabel, { color: colors.textSecondary }]}>{v.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.vitalDivider, { backgroundColor: colors.glassBorder }]} />}
            </React.Fragment>
          ))}
        </GlassCard>
      )}

      {/* Chat */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          return (
            <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: isUser ? colors.accent : colors.glassBackground,
                    borderColor: isUser ? colors.accent : colors.glassBorder,
                  },
                ]}
              >
                <Text style={[styles.bubbleText, { color: isUser ? "#FFFFFF" : colors.textPrimary }]}>{item.content}</Text>
                {item.actionsExecuted && item.actionsExecuted.length > 0 && (
                  <View style={[styles.actionsWrap, { borderTopColor: colors.glassBorder }]}>
                    <Text style={[styles.actionsHeader, { color: colors.accent }]}>PROTOCOL UPDATED</Text>
                    {item.actionsExecuted.map((act, idx) => (
                      <View key={idx} style={[styles.actionRow, { backgroundColor: colors.accentMuted }]}>
                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>{act.summary || act.badge}</Text>
                        <Text style={[styles.actionCheck, { color: colors.success }]}>Applied</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Quick Actions */}
      <View style={styles.quickWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {QUICK_ACTIONS.map((qa) => (
            <TouchableOpacity
              key={qa.label}
              activeOpacity={0.75}
              style={[styles.quickChip, { backgroundColor: chipBg, borderColor: colors.glassBorder }]}
              onPress={() => handleSend(qa.prompt)}
              disabled={sending}
            >
              <Text style={[styles.quickText, { color: colors.textSecondary }]}>{qa.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Row */}
      <View style={[styles.inputRow, { backgroundColor: inputBg, borderTopColor: colors.glassBorder }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.glassBackground, borderColor: colors.glassBorder, color: colors.textPrimary }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your coach..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.sendBtn, { backgroundColor: colors.accent }, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.sendText}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle: { fontSize: 13, marginTop: 2 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  activeDot: { width: 7, height: 7, borderRadius: 3.5 },
  activeText: { fontSize: 12, fontWeight: "700" },
  vitalsCard: { marginHorizontal: 16, flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 4 },
  vitalItem: { alignItems: "center", gap: 2 },
  vitalVal: { fontSize: 14, fontWeight: "600", letterSpacing: -0.2 },
  vitalLabel: { fontSize: 11 },
  vitalDivider: { width: 0.5, height: 28 },
  bubbleWrap: { width: "100%", alignItems: "flex-start" },
  bubbleWrapUser: { alignItems: "flex-end" },
  bubble: { maxWidth: "86%", borderRadius: 16, padding: 13, gap: 6, borderWidth: 0.5 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  actionsWrap: { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, gap: 6 },
  actionsHeader: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: "600" },
  actionCheck: { fontSize: 12, fontWeight: "600" },
  quickWrap: { paddingVertical: 8 },
  quickChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5 },
  quickText: { fontSize: 13, fontWeight: "500" },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, paddingBottom: Platform.OS === "ios" ? 30 : 10, borderTopWidth: 0.5 },
  input: { flex: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, maxHeight: 90, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.35 },
  sendText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
});
