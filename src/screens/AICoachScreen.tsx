import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { endpoints } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import type { AIChatMessage, AgentAction } from "@/types/models";

const QUICK_ACTIONS = [
  { label: "+500ml Water", prompt: "Log 500ml of water into my tracker" },
  { label: "-150 kcal", prompt: "Reduce my daily calorie target by 150 kcal" },
  { label: "Swap Lunch", prompt: "Swap my lunch for an alternate high protein recipe" },
  { label: "Audit Protocol", prompt: "Analyze my whole app progress and compliance" },
];

export function AICoachScreen() {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to your performance protocol. I oversee your training volume, hydration, and nutritional budget in real time. Tell me how you are performing today, or let me know if you need to adjust calories, log hydration, or modify a meal.",
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

    const userMsg: AIChatMessage = {
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setSending(true);

    try {
      const response = await endpoints.sendCoachMessage(text);
      setMessages((prev) => [...prev, response]);
      if (response.appVitals) {
        setLatestVitals(response.appVitals);
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Couldn't reach coach. Try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: msg, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Performance Coach</Text>
          <Text style={styles.subtitle}>Adaptive Protocol & Telemetry</Text>
        </View>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Coach Active</Text>
        </View>
      </View>

      {/* Live Vitals Telemetry Bar */}
      {latestVitals ? (
        <View style={styles.vitalsBar}>
          <View style={styles.vitalItem}>
            <Text style={styles.vitalValue}>{latestVitals.calorieTarget} kcal</Text>
            <Text style={styles.vitalLabel}>Daily Target</Text>
          </View>
          <View style={styles.vitalDivider} />
          <View style={styles.vitalItem}>
            <Text style={styles.vitalValue}>{latestVitals.waterConsumedMl} / {latestVitals.waterTargetMl} ml</Text>
            <Text style={styles.vitalLabel}>Hydration</Text>
          </View>
          <View style={styles.vitalDivider} />
          <View style={styles.vitalItem}>
            <Text style={styles.vitalValue}>{latestVitals.weightKg} kg</Text>
            <Text style={styles.vitalLabel}>Weight</Text>
          </View>
        </View>
      ) : null}

      {/* Chat Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ gap: 14, paddingVertical: 12 }}
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          return (
            <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                  {item.content}
                </Text>

                {/* Executed Agent Actions Badges */}
                {item.actionsExecuted && item.actionsExecuted.length > 0 ? (
                  <View style={styles.actionsContainer}>
                    <Text style={styles.actionsHeader}>PROTOCOL UPDATED</Text>
                    {item.actionsExecuted.map((act, idx) => (
                      <View key={idx} style={styles.actionCard}>
                        <Text style={styles.actionBadgeText}>{act.summary || act.badge}</Text>
                        <Text style={styles.actionCheck}>Applied</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {/* Quick Action Prompt Chips */}
      <View style={styles.quickActionsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {QUICK_ACTIONS.map((qa) => (
            <TouchableOpacity
              key={qa.label}
              activeOpacity={0.8}
              style={styles.quickActionChip}
              onPress={() => handleSend(qa.prompt)}
              disabled={sending}
            >
              <Text style={styles.quickActionText}>{qa.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Bar */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Instruct your agent (e.g. 'Log 500ml water')..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendBtnText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    paddingTop: 60,
    paddingBottom: 24,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  statusText: { color: "#10B981", fontSize: 11, fontWeight: "700" },
  vitalsBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: colors.border,
  },
  vitalItem: { alignItems: "center", gap: 2 },
  vitalValue: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  vitalLabel: { color: colors.textMuted, fontSize: 10, textTransform: "uppercase" },
  vitalDivider: { width: 1, height: 24, backgroundColor: colors.border },
  bubbleWrapper: { width: "100%", alignItems: "flex-start" },
  bubbleWrapperUser: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: colors.background,
    fontWeight: "600",
  },
  actionsContainer: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(212, 251, 52, 0.25)",
    gap: 6,
  },
  actionsHeader: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  actionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(212, 251, 52, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212, 251, 52, 0.2)",
  },
  actionBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  actionCheck: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "700",
  },
  quickActionsContainer: {
    paddingVertical: 4,
  },
  quickActionChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 90,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "800",
  },
});
