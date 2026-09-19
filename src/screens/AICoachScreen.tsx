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
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/store/ThemeContext";
import { GlassCard } from "@/components/GlassCard";
import { endpoints } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import type { AIChatMessage } from "@/types/models";

const QUICK_ACTIONS = [
  { label: "🎙️ Talk to Coach", prompt: "__VOICE_TALK__" },
  { label: "+500ml Water", prompt: "Log 500ml of water into my tracker" },
  { label: "-150 kcal", prompt: "Reduce my daily calorie target by 150 kcal" },
  { label: "Swap Lunch", prompt: "Swap my lunch for an alternate high protein recipe" },
  { label: "Audit Protocol", prompt: "Analyze my whole app progress and compliance" },
];

/** Strip raw markdown, HTML entities, and formatting symbols so text displays cleanly */
function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    // Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Code blocks & inline backticks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Bold / italic (double or triple asterisks/underscores)
    .replace(/\*{2,3}([^\*]+)\*{2,3}/g, "$1")
    .replace(/\*([^\*\n]+)\*/g, "$1")
    .replace(/_{2,3}([^_]+)_{2,3}/g, "$1")
    .replace(/_([^\_\n]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    // Any remaining stray asterisks
    .replace(/\*+/g, "")
    // Markdown bullets (- or + or * at line start)
    .replace(/^[\-\+]\s+/gm, "• ")
    // Markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .trim();
}

/** Render message text with proper line breaks, bullet formatting, and Apple-like typography */
function MessageText({ text, color }: { text: string; color: string }) {
  const clean = stripMarkdown(text);
  const lines = clean.split("\n");
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed === "") {
          return <View key={i} style={{ height: 6 }} />;
        }
        const isBullet = trimmed.startsWith("•");
        return (
          <View key={i} style={isBullet ? { flexDirection: "row", paddingLeft: 4, gap: 6 } : undefined}>
            {isBullet ? (
              <>
                <Text style={{ fontSize: 15, lineHeight: 22, color, opacity: 0.85 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color }}>{trimmed.slice(1).trim()}</Text>
              </>
            ) : (
              <Text style={{ fontSize: 15, lineHeight: 22, color }}>{line}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function AICoachScreen({ navigation }: any) {
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
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const onShow = () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 60);
    };
    const onHide = () => {
      setKeyboardVisible(false);
    };

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const tabHeight = Platform.OS === "ios" ? 82 : 68;
  const dynamicBottomPadding = keyboardVisible
    ? (Platform.OS === "ios" ? Math.max(insets.bottom, 10) : 10)
    : tabHeight + Math.max(insets.bottom, 6);

  // Text-To-Speech
  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = stripMarkdown(text);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }

  function stopAudio() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsSpeaking(false);
  }

  // Voice Recognition (Speech-to-Text)
  function toggleVoiceInput() {
    if (typeof window === "undefined") return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Voice speech recognition is active on Chrome, Edge, Safari, or via your keyboard dictation microphone (🎙️ icon).");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition notice:", e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn("Could not start speech recognition:", e);
      setIsListening(false);
    }
  }

  // Load live vitals and conversation history on mount and focus
  useEffect(() => {
    let mounted = true;
    async function loadVitalsAndHistory() {
      try {
        const vitals = await endpoints.getCoachVitals();
        if (mounted && vitals) {
          setLatestVitals(vitals);
        }
      } catch (e) {
        console.warn("Could not load initial coach vitals:", e);
      }

      try {
        const history = await endpoints.getCoachHistory();
        if (mounted && history?.messages && history.messages.length > 0) {
          const mapped: AIChatMessage[] = history.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            actionsExecuted: m.actionsExecuted,
            createdAt: m.timestamp || new Date().toISOString(),
          }));
          setMessages(mapped);
        }
      } catch (e) {
        // Fallback to initial welcome message
      }
    }
    loadVitalsAndHistory();
    return () => {
      mounted = false;
      stopAudio();
    };
  }, []);

  async function handleSend(textToSend?: string) {
    if (textToSend === "__VOICE_TALK__") {
      toggleVoiceInput();
      return;
    }

    const text = (textToSend || input).trim();
    if (!text || sending) return;

    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsListening(false);
    }

    const userMsg: AIChatMessage = { role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setSending(true);
    try {
      const response = await endpoints.sendCoachMessage(text);
      setMessages((prev) => [...prev, response]);
      if (response.appVitals) setLatestVitals(response.appVitals);
      if (voiceEnabled) {
        speak(response.content);
      }
    } catch (err: any) {
      console.warn("Coach chat error:", err);
      const msg = err instanceof ApiError ? err.message : "Couldn't reach coach. Check your network or connection.";
      setMessages((prev) => [...prev, { role: "assistant", content: msg, createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  }

  const inputBg = isDark ? "rgba(28,28,30,0.95)" : "rgba(255,255,255,0.95)";
  const chipBg = isDark ? "rgba(44,44,46,0.75)" : "rgba(229,229,234,0.85)";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 54 : (insets.top > 0 ? insets.top + 10 : 44) }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => navigation?.navigate?.("Dashboard")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <Text style={[styles.backBtnText, { color: colors.accent }]}>‹ Today</Text>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                if (isSpeaking) {
                  stopAudio();
                }
                setVoiceEnabled(!voiceEnabled);
              }}
              style={[
                styles.voiceBadge,
                {
                  backgroundColor: voiceEnabled ? colors.accentMuted : colors.glassBackground,
                  borderColor: voiceEnabled ? colors.accent : colors.glassBorder,
                },
              ]}
            >
              <Text style={{ fontSize: 12 }}>{voiceEnabled ? "🔊" : "🔇"}</Text>
              <Text style={[styles.voiceText, { color: voiceEnabled ? colors.accent : colors.textMuted }]}>
                {voiceEnabled ? "Voice" : "Mute"}
              </Text>
            </TouchableOpacity>

            <View style={[styles.activeBadge, { backgroundColor: colors.successMuted }]}>
              <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.activeText, { color: colors.success }]}>Online</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerTitleBlock}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>AI Coach</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Adaptive Performance Protocol</Text>
        </View>
      </View>

      {/* Live Vitals (Auto-collapses when typing so keyboard does not squeeze chat) */}
      {latestVitals && !keyboardVisible && (
        <GlassCard strong style={styles.vitalsCard}>
          {[
            { label: "Target", val: `${latestVitals.calorieTarget} kcal` },
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
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
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
                    borderBottomRightRadius: isUser ? 4 : 18,
                    borderBottomLeftRadius: isUser ? 18 : 4,
                  },
                ]}
              >
                <MessageText text={item.content} color={isUser ? "#FFFFFF" : colors.textPrimary} />

                {!isUser && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.listenBtn}
                    onPress={() => speak(item.content)}
                  >
                    <Text style={{ fontSize: 12 }}>🔊</Text>
                    <Text style={[styles.listenText, { color: colors.textTertiary }]}>Listen</Text>
                  </TouchableOpacity>
                )}

                {item.actionsExecuted && item.actionsExecuted.length > 0 && (
                  <View style={[styles.actionsWrap, { borderTopColor: colors.glassBorder }]}>
                    <Text style={[styles.actionsHeader, { color: colors.accent }]}>PROTOCOL UPDATED</Text>
                    {item.actionsExecuted.map((act: any, idx: number) => (
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

      {/* Quick Actions (Hidden when typing to free up chat screen) */}
      {!keyboardVisible && (
        <View style={styles.quickWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {QUICK_ACTIONS.map((qa) => (
              <TouchableOpacity
                key={qa.label}
                activeOpacity={0.75}
                style={[
                  styles.quickChip,
                  { backgroundColor: chipBg, borderColor: colors.glassBorder },
                  qa.prompt === "__VOICE_TALK__" && isListening && { backgroundColor: "#FF3B30", borderColor: "#FF3B30" },
                ]}
                onPress={() => handleSend(qa.prompt)}
                disabled={sending}
              >
                <Text
                  style={[
                    styles.quickText,
                    { color: qa.prompt === "__VOICE_TALK__" && isListening ? "#FFF" : colors.textSecondary },
                  ]}
                >
                  {qa.prompt === "__VOICE_TALK__" && isListening ? "⏹️ Stop Listening" : qa.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Voice Listening Banner */}
      {isListening && (
        <View style={[styles.listeningBanner, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
          <View style={styles.listeningDot} />
          <Text style={[styles.listeningText, { color: colors.accent }]}>
            Listening... Speak your command or fitness question
          </Text>
          <TouchableOpacity onPress={toggleVoiceInput} style={styles.listeningDoneBtn}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Chat Section */}
      <View
        style={[
          styles.bottomSection,
          {
            backgroundColor: inputBg,
            borderTopColor: colors.glassBorder,
            paddingBottom: dynamicBottomPadding,
          },
        ]}
      >
        <View style={styles.inputRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.micBtn,
              {
                backgroundColor: isListening ? "#FF3B30" : colors.glassBackground,
                borderColor: isListening ? "#FF3B30" : colors.glassBorder,
              },
            ]}
            onPress={toggleVoiceInput}
          >
            <Text style={{ fontSize: 16 }}>{isListening ? "⏹️" : "🎙️"}</Text>
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.glassBackground,
                borderColor: colors.glassBorder,
                color: colors.textPrimary,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder={isListening ? "Listening to your voice..." : "Ask coach or tap 🎙️ to talk..."}
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.sendBtn,
              { backgroundColor: colors.accent },
              (!input.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.sendText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitleBlock: {
    gap: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  vitalsCard: {
    marginHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: 4,
    paddingVertical: 10,
  },
  vitalItem: {
    alignItems: "center",
    gap: 2,
  },
  vitalVal: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  vitalLabel: {
    fontSize: 11,
  },
  vitalDivider: {
    width: 0.5,
    height: 26,
  },
  bubbleWrap: {
    width: "100%",
    alignItems: "flex-start",
  },
  bubbleWrapUser: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 0.5,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  actionsWrap: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    gap: 4,
  },
  actionsHeader: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionCheck: {
    fontSize: 11,
    fontWeight: "600",
  },
  quickWrap: {
    paddingVertical: 6,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 0.5,
  },
  quickText: {
    fontSize: 12,
    fontWeight: "500",
  },
  bottomSection: {
    borderTopWidth: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 0.5,
    minHeight: 40,
    maxHeight: 90,
    fontSize: 15,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  sendText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  voiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  voiceText: {
    fontSize: 11,
    fontWeight: "600",
  },
  listenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    alignSelf: "flex-end",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  listenText: {
    fontSize: 11,
    fontWeight: "600",
  },
  listeningBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    marginRight: 8,
  },
  listeningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  listeningDoneBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
});
