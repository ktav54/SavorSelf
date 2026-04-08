import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Field, PrimaryButton, SectionTitle } from "@/components/ui";
import { formatFoodName } from "@/lib/utils";
import { parseFoodMessage, sendCoachMessage } from "@/services/coach";
import { useAppStore } from "@/store/useAppStore";
import type { CoachFoodItem, CoachFoodProposal } from "@/types/models";

const FOOD_TRIGGER_PATTERN = /\b(i had|i ate|i drank|log|add)\b/i;
const QUESTION_START_PATTERN = /^(what|why|how|where|when)\b/i;

function shouldUseFoodParser(message: string, recentSuccessfulFoodLogs: number) {
  const trimmed = message.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const hasFoodTrigger = FOOD_TRIGGER_PATTERN.test(trimmed);
  const startsWithQuestionWord = QUESTION_START_PATTERN.test(trimmed.toLowerCase());

  if (startsWithQuestionWord) {
    return false;
  }

  if (wordCount < 6 && !hasFoodTrigger) {
    return false;
  }

  if (recentSuccessfulFoodLogs > 0) {
    return hasFoodTrigger;
  }

  return true;
}

function buildLoggedFollowUp(mealType: string, items: CoachFoodItem[]) {
  const names = items.map((item) => formatFoodName(item.name).toLowerCase());

  if (names.some((name) => /salmon|sardine|mackerel|walnut|flax/.test(name))) {
    return `Logged to your ${mealType}. By the way, foods like that are rich in omega-3s, which can support mood by helping calm neuroinflammation. Your Food-Mood patterns will start picking that up over time.`;
  }

  if (names.some((name) => /yogurt|kefir|kimchi|sauerkraut|kombucha/.test(name))) {
    return `Logged to your ${mealType}. Fermented foods like that can be especially interesting for Food-Mood because they support gut diversity, which can influence mood and energy over time.`;
  }

  if (names.some((name) => /oat|bean|lentil|apple|berry|broccoli/.test(name))) {
    return `Logged to your ${mealType}. That one brings in fiber, which matters more than it gets credit for. Your Food-Mood data may start to reflect that in steadier energy and mood patterns.`;
  }

  return `Logged to your ${mealType}. I will keep that in mind as your Food-Mood picture develops over the next few days.`;
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
  const [recentSuccessfulFoodLogs, setRecentSuccessfulFoodLogs] = useState(0);

  useEffect(() => {
    setDraft("");
    setPendingProposal(null);
    setRecentSuccessfulFoodLogs(0);
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
      pendingFoodProposal: pendingProposal
        ? {
            mealType: pendingProposal.mealType,
            items: pendingProposal.items.map((item) => ({
              name: formatFoodName(item.name),
              portion: item.portion,
            })),
          }
        : null,
    }),
    [foodLogs, insights, journalEntries, moodLogs, pendingProposal, quickLogs]
  );

  const appendAssistant = (
    content: string,
    kind: "text" | "food_summary" | "clarification" | "status" = "text",
    foodProposal?: CoachFoodProposal
  ) => {
    addCoachMessage({
      role: "assistant",
      content: content?.trim() ? content : "Something went wrong, try again",
      timestamp: new Date().toISOString(),
      kind,
      foodProposal,
    });
  };

  const submit = async () => {
    if (!draft.trim()) {
      return;
    }

    const message = draft.trim();
    const history = [
      ...conversation.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      {
        role: "user" as const,
        content: message,
      },
    ];

    addCoachMessage({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });

    setDraft("");

    setSending(true);
    try {
      if (shouldUseFoodParser(message, recentSuccessfulFoodLogs)) {
        const foodResult = await parseFoodMessage({
          message,
          pendingProposal,
          history,
        });

        if (foodResult.isFoodLogging) {
          if (foodResult.needsClarification) {
            appendAssistant(
              foodResult.question ??
                "Could you tell me a little more about the portion so I can log it accurately?",
              "clarification"
            );
            return;
          }

          if (foodResult.items?.length) {
            const proposal: CoachFoodProposal = {
              isFoodLogging: true,
              needsClarification: false,
              mealType: foodResult.mealType ?? pendingProposal?.mealType ?? "snack",
              items: foodResult.items,
              sourceMessage: message,
            };
            setPendingProposal(proposal);
            appendAssistant(
              "Here is my best estimate. Take a quick look and confirm or tell me what you want to adjust.",
              "food_summary",
              proposal
            );
            return;
          }
        }
      }

      const result = await sendCoachMessage(message, coachContext);
      appendAssistant(result.reply?.trim() || "Something went wrong, try again", "text");
      if (recentSuccessfulFoodLogs > 0) {
        setRecentSuccessfulFoodLogs((current) => Math.max(current - 1, 0));
      }
    } catch (error) {
      appendAssistant(
        error instanceof Error
          ? error.message
          : "I hit a snag while trying to respond. Please try again.",
        "status"
      );
    } finally {
      setSending(false);
    }
  };

  const confirmProposal = async () => {
    if (!pendingProposal) {
      return;
    }

    console.log("[coach] confirmProposal starting", pendingProposal);
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
      console.log("[coach] confirmProposal failed", result.error);
      appendAssistant(result.error, "status");
      return;
    }

    console.log("[coach] confirmProposal completed", proposalToSave);
    appendAssistant(`Logged to your ${proposalToSave.mealType}.`, "status");
    appendAssistant(buildLoggedFollowUp(proposalToSave.mealType, proposalToSave.items), "text");
    setPendingProposal(null);
    setRecentSuccessfulFoodLogs(2);
  };

  const openInsights = async () => {
    await loadFoodMoodInsights();
    const latestInsights = useAppStore.getState().insights.slice(0, 3);
    addCoachMessage({
      role: "assistant",
      content:
        latestInsights.length > 0
          ? `Here’s what stands out right now:\n\n${latestInsights.map((insight) => `• ${insight.insightBody}`).join("\n")}`
          : "I’m starting to look for your Food-Mood patterns. A few more check-ins will help me say something personal and true.",
      timestamp: new Date().toISOString(),
      kind: "text",
    });
  };

  const openFoodLogging = () => {
    addCoachMessage({
      role: "assistant",
      content: "Tell me what you ate in your own words. I’ll turn it into a log and check the nutrition for you.",
      timestamp: new Date().toISOString(),
      kind: "text",
    });
  };

  const openGeneralChat = () => {
    addCoachMessage({
      role: "assistant",
      content: "We can keep this simple. Tell me how you’ve been feeling, and we’ll sort through it together.",
      timestamp: new Date().toISOString(),
      kind: "text",
    });
  };

  return (
    <View style={styles.stack}>
      {!hasStartedConversation ? (
        <Card>
          <SectionTitle
            eyebrow="Start Here"
            title="What would feel most supportive right now?"
            subtitle="These are just gentle starting points. We can move anywhere in the conversation from there."
          />
          <Pressable style={styles.optionCard} onPress={() => void openInsights()}>
            <Text style={styles.optionTitle}>Analyze my Food-Mood patterns</Text>
            <Text style={styles.optionBody}>Bring your recent logs into focus and show what’s actually starting to connect.</Text>
          </Pressable>
          <Pressable style={styles.optionCard} onPress={openFoodLogging}>
            <Text style={styles.optionTitle}>Log my food</Text>
            <Text style={styles.optionBody}>Describe what you ate naturally, and I’ll help turn it into a real food log.</Text>
          </Pressable>
          <Pressable style={styles.optionCard} onPress={openGeneralChat}>
            <Text style={styles.optionTitle}>Just talk</Text>
            <Text style={styles.optionBody}>No agenda needed. We can talk through energy, mood, guilt, stress, or whatever is sitting with you.</Text>
          </Pressable>
        </Card>
      ) : null}
      {conversation.map((message, index) => (
        <View key={`${message.timestamp}-${index}`} style={styles.messageWrap}>
          <View
            style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}
          >
            <Text style={styles.bubbleText}>{message.content}</Text>
          </View>
          {message.role === "assistant" && message.foodProposal ? (
            <Card>
              <Text style={styles.summaryLabel}>{message.foodProposal.mealType}</Text>
              {message.foodProposal.items.map((item) => (
                <View key={`${message.timestamp}-${item.name}`} style={styles.summaryRow}>
                  <View style={styles.summaryCopy}>
                    <Text style={styles.summaryName}>{formatFoodName(item.name)}</Text>
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
                    onPress={() => {
                      addCoachMessage({
                        role: "assistant",
                        content: "Tell me what to adjust and I'll revise the estimate.",
                        timestamp: new Date().toISOString(),
                        kind: "clarification",
                      });
                    }}
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
        <PrimaryButton label={sending ? "Thinking..." : "Send"} onPress={() => void submit()} />
        {sending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accentPrimary} />
            <Text style={styles.loadingText}>
              {pendingProposal
                ? "Holding your food log in place while I respond..."
                : "Listening and pulling your context together..."}
            </Text>
          </View>
        ) : null}
      </Card>
      <View style={styles.promptRow}>
        <Text style={styles.promptTitle}>Suggested prompts</Text>
        {[
          "I had two scrambled eggs with toast and a coffee",
          "Actually how has my mood been this week?",
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
  stack: {
    gap: spacing.md,
  },
  messageWrap: {
    gap: spacing.sm,
  },
  bubble: {
    padding: spacing.md,
    borderRadius: radii.lg,
    maxWidth: "88%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentPrimary,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 25,
  },
  promptRow: {
    gap: spacing.sm,
  },
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
  optionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "600",
  },
  optionBody: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
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
  summaryCopy: {
    gap: 4,
  },
  summaryName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    maxWidth: 180,
  },
  summaryMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  estimateTag: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  summaryMacro: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  actionRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
