// components/coach.tsx
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Field, PrimaryButton, SectionTitle } from "@/components/ui";
import { formatFoodName } from "@/lib/utils";
import { sendMessage } from "@/services/coach";
import { useAppStore } from "@/store/useAppStore";
import type { CoachFoodItem, CoachFoodProposal } from "@/types/models";

function buildLoggedFollowUp(mealType: string, items: CoachFoodItem[]) {
  const names = items.map((item) => formatFoodName(item.name).toLowerCase());

  if (names.some((name) => /salmon|sardine|mackerel|walnut|flax/.test(name))) {
    return `Logged to your ${mealType}. Foods like that are rich in omega-3s, which support mood by calming neuroinflammation. Your Food-Mood patterns will start picking that up over time.`;
  }
  if (names.some((name) => /yogurt|kefir|kimchi|sauerkraut|kombucha/.test(name))) {
    return `Logged to your ${mealType}. Fermented foods support gut diversity, which can influence mood and energy over time.`;
  }
  if (names.some((name) => /oat|bean|lentil|apple|berry|broccoli/.test(name))) {
    return `Logged to your ${mealType}. That one brings in fiber, which matters more than it gets credit for. Steadier energy and mood patterns often follow.`;
  }
  return `Logged to your ${mealType}. I'll keep that in mind as your Food-Mood picture develops.`;
}

export function CoachBanner() {
  return (
    <Card>
      <SectionTitle
        eyebrow="Coach"
        title="A calm, warm place to think out loud"
        subtitle="We can move between food logging, patterns, and whatever is on your mind without losing the thread."
      />
    </Card>
  );
}

export function CoachChat() {
  const conversation = useAppStore((state) => state.conversation);
  const conversationResetCount = useAppStore((state) => state.conversationResetCount);
  const moodLogs = useAppStore((state) => state.moodLogs);
  const foodLogs = useAppStore((state) => state.foodLogs);
  const quickLogs = useAppStore((state) => state.quickLogs);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const insights = useAppStore((state) => state.insights);
  const loadFoodMoodInsights = useAppStore((state) => state.loadFoodMoodInsights);
  const addCoachMessage = useAppStore((state) => state.addCoachMessage);
  const saveMultipleFoodLogs = useAppStore((state) => state.saveMultipleFoodLogs);

  const [draft, setDraft] = useState("");
  const [pendingProposal, setPendingProposal] = useState<CoachFoodProposal | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<number | null>(null);
  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editFat, setEditFat] = useState("");
  const [editName, setEditName] = useState("");

  useEffect(() => {
    setDraft("");
    setPendingProposal(null);
  }, [conversationResetCount]);

  const hasStartedConversation = useMemo(
    () => conversation.some((entry) => entry.role === "user"),
    [conversation]
  );

  const coachContext = useMemo(
    () => ({
      moodLogs: moodLogs.slice(-7),
      foodSummary: {
        averageCalories: Math.round(
          foodLogs.reduce((sum, item) => sum + item.calories, 0) / Math.max(foodLogs.length, 1)
        ),
        averageProtein: Math.round(
          foodLogs.reduce((sum, item) => sum + item.proteinG, 0) / Math.max(foodLogs.length, 1)
        ),
        averageFiber: Math.round(
          foodLogs.reduce((sum, item) => sum + item.fiberG, 0) / Math.max(foodLogs.length, 1)
        ),
        tags: Array.from(new Set(foodLogs.flatMap((item) => item.gutHealthTags))),
      },
      quickLogs: quickLogs.slice(-7),
      journalEntries: journalEntries.slice(-3).map((entry) => entry.body),
      insights: insights.slice(0, 3),
    }),
    [foodLogs, insights, journalEntries, moodLogs, quickLogs]
  );

  const appendAssistant = (
    content: string,
    kind: "text" | "food_summary" | "clarification" | "status" = "text",
    foodProposal?: CoachFoodProposal
  ) => {
    addCoachMessage({
      role: "assistant",
      content: content?.trim() ? content : "Something went wrong, try again.",
      timestamp: new Date().toISOString(),
      kind,
      foodProposal,
    });
  };

  const submit = async () => {
    if (!draft.trim() || sending) return;
    const message = draft.trim();
    const history = conversation
      .filter((m) => m.content.length < 400)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    addCoachMessage({ role: "user", content: message, timestamp: new Date().toISOString() });
    setDraft("");
    setSending(true);
    try {
      const result = await sendMessage({ message, history, context: coachContext, pendingProposal });
      switch (result.intent) {
        case "food_log": {
          if (result.items?.length) {
            const proposal: CoachFoodProposal = {
              isFoodLogging: true,
              needsClarification: false,
              mealType: result.mealType ?? "snack",
              items: result.items,
              sourceMessage: message,
            };
            setPendingProposal(proposal);
            appendAssistant(result.reply || "Here's my estimate. Confirm or tell me what to adjust.", "food_summary", proposal);
          } else {
            appendAssistant(result.reply || "Got it.", "text");
          }
          break;
        }
        case "macro_edit": {
          const edits = (result as any).macroEdits ?? ((result as any).macroEdit ? [(result as any).macroEdit] : null);
          if (edits?.length && pendingProposal) {
            const updatedItems = pendingProposal.items.map((item, i) => {
              const edit = edits.find((e: any) => e.itemIndex === i);
              if (!edit) return item;
              return {
                ...item,
                ...(edit.name != null ? { name: edit.name } : {}),
                ...(edit.calories != null ? { calories: edit.calories } : {}),
                ...(edit.protein != null ? { protein: edit.protein } : {}),
                ...(edit.carbs != null ? { carbs: edit.carbs } : {}),
                ...(edit.fat != null ? { fat: edit.fat } : {}),
              };
            });
            const updatedProposal = { ...pendingProposal, items: updatedItems };
            setPendingProposal(updatedProposal);
            appendAssistant(result.reply || "Updated.", "food_summary", updatedProposal);
          } else {
            appendAssistant(result.reply || "Got it.", "text");
          }
          break;
        }
        case "clarification":
          appendAssistant(result.reply, "clarification");
          break;
        default:
          appendAssistant(result.reply || "I'm here with you.", "text");
      }
    } catch (error) {
      appendAssistant(error instanceof Error ? error.message : "I hit a snag. Please try again.", "status");
    } finally {
      setSending(false);
    }
  };

  const confirmProposal = async () => {
    if (!pendingProposal) return;

    setConfirming(true);
    const proposalToSave = pendingProposal;

    const result = await saveMultipleFoodLogs(
      proposalToSave.items.map((item) => ({
        foodName: item.name,
        foodSource: item.foodSource,
        externalFoodId: item.externalFoodId,
        mealType: proposalToSave.mealType,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        proteinG: item.protein,
        carbsG: item.carbs,
        fatG: item.fat,
        fiberG: item.fiber,
        sugarG: item.sugar,
      }))
    );

    setConfirming(false);

    if (result.error) {
      appendAssistant(result.error, "status");
      return;
    }

    appendAssistant(`Logged to your ${proposalToSave.mealType}.`, "status");
    appendAssistant(buildLoggedFollowUp(proposalToSave.mealType, proposalToSave.items), "text");
    setPendingProposal(null);
  };

  const openInsights = async () => {
    await loadFoodMoodInsights();
    const latestInsights = useAppStore.getState().insights.slice(0, 3);
    addCoachMessage({
      role: "assistant",
      content:
        latestInsights.length > 0
          ? `Here's what stands out right now:\n\n${latestInsights.map((i) => `• ${i.insightBody}`).join("\n")}`
          : "I'm starting to look for your Food-Mood patterns. A few more check-ins will help me say something personal and true.",
      timestamp: new Date().toISOString(),
      kind: "text",
    });
  };

  const openFoodLogging = () => {
    addCoachMessage({
      role: "assistant",
      content: "Tell me what you ate in your own words. I'll turn it into a log and check the nutrition for you.",
      timestamp: new Date().toISOString(),
      kind: "text",
    });
  };

  const openGeneralChat = () => {
    addCoachMessage({
      role: "assistant",
      content: "We can keep this simple. Tell me how you've been feeling, and we'll sort through it together.",
      timestamp: new Date().toISOString(),
      kind: "text",
    });
  };

  const openAdjustModal = (itemIndex: number) => {
    if (!pendingProposal) return;
    const item = pendingProposal.items[itemIndex];
    setAdjustingItem(itemIndex);
    setEditName(item.name);
    setEditCalories(String(Math.round(item.calories)));
    setEditProtein(String(Math.round(item.protein)));
    setEditCarbs(String(Math.round(item.carbs)));
    setEditFat(String(Math.round(item.fat)));
    setAdjustModalVisible(true);
  };

  const applyAdjustment = () => {
    if (!pendingProposal || adjustingItem === null) return;
    const updatedItems = pendingProposal.items.map((item, i) => {
      if (i !== adjustingItem) return item;
      return {
        ...item,
        name: editName.trim() || item.name,
        calories: Number(editCalories) || item.calories,
        protein: Number(editProtein) || item.protein,
        carbs: Number(editCarbs) || item.carbs,
        fat: Number(editFat) || item.fat,
      };
    });
    const updatedProposal = { ...pendingProposal, items: updatedItems };
    setPendingProposal(updatedProposal);
    setAdjustModalVisible(false);
    setAdjustingItem(null);
  };

  return (
    <View style={styles.stack}>
      {!hasStartedConversation ? (
        <Card>
          <SectionTitle
            eyebrow="Start Here"
            title="What would feel most supportive right now?"
            subtitle="These are just gentle starting points. We can move anywhere from there."
          />
          <Pressable style={styles.optionCard} onPress={() => void openInsights()}>
            <Text style={styles.optionTitle}>Analyze my Food-Mood patterns</Text>
            <Text style={styles.optionBody}>Bring your recent logs into focus and show what's actually starting to connect.</Text>
          </Pressable>
          <Pressable style={styles.optionCard} onPress={openFoodLogging}>
            <Text style={styles.optionTitle}>Log my food</Text>
            <Text style={styles.optionBody}>Describe what you ate naturally, and I'll help turn it into a real food log.</Text>
          </Pressable>
          <Pressable style={styles.optionCard} onPress={openGeneralChat}>
            <Text style={styles.optionTitle}>Just talk</Text>
            <Text style={styles.optionBody}>No agenda needed. We can talk through energy, mood, guilt, stress, or whatever is sitting with you.</Text>
          </Pressable>
        </Card>
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={adjustModalVisible}
        onRequestClose={() => setAdjustModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(44,26,14,0.4)", justifyContent: "center", alignItems: "center", padding: 24 }}
          onPress={() => setAdjustModalVisible(false)}
        >
          <Pressable
            style={{ backgroundColor: "#FAF7F2", borderRadius: 20, padding: 24, width: "100%", gap: 16, borderWidth: 1, borderColor: "rgba(44,26,14,0.1)" }}
            onPress={() => {}}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#2C1A0E" }}>Food Macros</Text>
            <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5 }}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Calories</Text>
                <TextInput
                  value={editCalories}
                  onChangeText={setEditCalories}
                  keyboardType="numeric"
                  style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Protein (g)</Text>
                <TextInput
                  value={editProtein}
                  onChangeText={setEditProtein}
                  keyboardType="numeric"
                  style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Carbs (g)</Text>
                <TextInput
                  value={editCarbs}
                  onChangeText={setEditCarbs}
                  keyboardType="numeric"
                  style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Fat (g)</Text>
                <TextInput
                  value={editFat}
                  onChangeText={setEditFat}
                  keyboardType="numeric"
                  style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                />
              </View>
            </View>
            <Pressable
              onPress={applyAdjustment}
              style={{ backgroundColor: "#C4622D", borderRadius: 14, padding: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Save changes</Text>
            </Pressable>
            <Pressable
              onPress={() => setAdjustModalVisible(false)}
              style={{ alignItems: "center", padding: 8 }}
            >
              <Text style={{ color: "#7A6155", fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {conversation.map((message, index) => (
        <View key={`${message.timestamp}-${index}`} style={styles.messageWrap}>
          <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}>
            <Text style={styles.bubbleText}>{message.content}</Text>
          </View>

          {message.role === "assistant" && message.foodProposal ? (
            <Card>
              <Text style={styles.summaryLabel}>{message.foodProposal.mealType}</Text>
              {(pendingProposal && message.foodProposal.sourceMessage === pendingProposal.sourceMessage ? pendingProposal.items : message.foodProposal.items).map((item, itemIndex) => (
                <View key={`${message.timestamp}-${item.name}`} style={styles.summaryRow}>
                  <View style={styles.summaryCopy}>
                    <View style={styles.summaryTitleRow}>
                      <Text style={styles.summaryName}>{formatFoodName(item.name)}</Text>
                      {message.foodProposal.items.length > 1 ? (
                        <Pressable onPress={() => openAdjustModal(itemIndex)}>
                          <Text style={styles.editLink}>Edit</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {item.foodSource === "ai_estimate" ? (
                      <Text style={styles.estimateTag}>AI estimate</Text>
                    ) : null}
                    <Text style={styles.summaryMeta}>{item.portion}</Text>
                  </View>
                  <View style={styles.summaryCopy}>
                    <Text style={styles.summaryMacro}>{Math.round(item.calories)} cal</Text>
                    <Text style={styles.summaryMeta}>
                      {Math.round(item.protein)}p | {Math.round(item.carbs)}c | {Math.round(item.fat)}f
                    </Text>
                  </View>
                </View>
              ))}
              {pendingProposal && message.foodProposal.sourceMessage === pendingProposal.sourceMessage ? (
                <View style={styles.actionRow}>
                  <PrimaryButton
                    label={confirming ? "Saving..." : "Confirm and log"}
                    onPress={() => void confirmProposal()}
                  />
                  <PrimaryButton
                    label="Adjust"
                    secondary
                    onPress={() => openAdjustModal(0)}
                  />
                </View>
              ) : null}
            </Card>
          ) : null}
        </View>
      ))}

      <Card>
        <Field
          label="Message"
          value={draft}
          onChangeText={setDraft}
          placeholder="I had two scrambled eggs with toast and a coffee..."
          multiline
        />
        {draft.length > 400 ? (
          <Text style={{ color: colors.accentPrimary, fontSize: 12, marginTop: 4 }}>
            Message is getting long - consider sending in shorter messages for best results.
          </Text>
        ) : null}
        <PrimaryButton
          label={sending ? "Thinking..." : "Send"}
          onPress={() => void submit()}
        />
        {sending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accentPrimary} />
            <Text style={styles.loadingText}>
              {pendingProposal
                ? "Updating your food log..."
                : "Listening and thinking..."}
            </Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.promptRow}>
        <Text style={styles.promptTitle}>Suggested prompts</Text>
        {[
          "I had two scrambled eggs with toast and a coffee",
          "How has my mood been this week?",
          "Lunch was a turkey sandwich, chips, and an apple",
        ].map((prompt) => (
          <Pressable key={prompt} onPress={() => setDraft(prompt)}>
            <Text style={styles.promptChip}>{prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  messageWrap: { gap: spacing.sm },
  bubble: { padding: spacing.md, borderRadius: radii.lg, maxWidth: "88%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.accentPrimary },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { color: colors.textPrimary, fontSize: 16, lineHeight: 25 },
  promptRow: { gap: spacing.sm },
  promptTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  promptChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  optionCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
  },
  optionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "600" },
  optionBody: { color: colors.textSecondary, fontSize: 15, lineHeight: 24 },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: 6,
  },
  summaryCopy: { gap: 4 },
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    maxWidth: 180,
  },
  editLink: {
    color: colors.accentPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  summaryMeta: { color: colors.textSecondary, fontSize: 13 },
  estimateTag: { color: colors.textSecondary, fontSize: 12 },
  summaryMacro: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  actionRow: { gap: spacing.sm, marginTop: spacing.sm },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
});


