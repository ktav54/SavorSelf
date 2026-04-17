// components/coach.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Field, PrimaryButton, SectionTitle } from "@/components/ui";
import { formatFoodName } from "@/lib/utils";
import { sendMessage } from "@/services/coach";
import { useAppStore } from "@/store/useAppStore";
import type { CoachFoodItem, CoachFoodProposal, FoodUnit } from "@/types/models";

type AdjustDraftItem = {
  name: string;
  quantityWhole: string;
  quantityFraction: string;
  unit: FoodUnit;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  mode: "serving" | "macros";
  showUnitPicker: boolean;
  originalQuantity: number;
  originalCalories: number;
  originalProtein: number;
  originalCarbs: number;
  originalFat: number;
};

const quantityWholeOptions = Array.from({ length: 13 }, (_, index) => String(index));
const quantityFractionOptions = [
  { label: "0", value: 0 },
  { label: "1/4", value: 0.25 },
  { label: "1/3", value: 1 / 3 },
  { label: "1/2", value: 0.5 },
  { label: "2/3", value: 2 / 3 },
  { label: "3/4", value: 0.75 },
] as const;

function getCoachUnitOptions(preferredUnits?: "imperial" | "metric"): FoodUnit[] {
  if (preferredUnits === "metric") {
    return ["g", "ml", "serving", "piece"];
  }

  return ["oz", "fl_oz", "cup", "serving", "piece", "tbsp", "tsp"];
}

function roundMacroValue(value: number) {
  return Math.max(0, Math.round(value));
}

function getFractionValue(label: string) {
  return quantityFractionOptions.find((option) => option.label === label)?.value ?? 0;
}

function getQuantityFromDraft(item: AdjustDraftItem) {
  return Number(item.quantityWhole || "0") + getFractionValue(item.quantityFraction);
}

function getQuantityParts(quantity: number) {
  const whole = Math.floor(quantity);
  const fractionValue = quantity - whole;
  const closestFraction = quantityFractionOptions.reduce((best, option) =>
    Math.abs(option.value - fractionValue) < Math.abs(best.value - fractionValue) ? option : best
  );

  if (whole === 0 && closestFraction.value === 0) {
    return {
      whole: "1",
      fraction: "0",
    };
  }

  return {
    whole: String(whole),
    fraction: closestFraction.label,
  };
}

function formatQuantityLabel(whole: string, fraction: string) {
  const wholeValue = Number(whole || "0");
  const pieces: string[] = [];

  if (wholeValue > 0) {
    pieces.push(String(wholeValue));
  }

  if (fraction !== "0") {
    pieces.push(fraction);
  }

  if (pieces.length === 0) {
    return "0";
  }

  return pieces.join(" ");
}

function scaleDraftFromServing(item: AdjustDraftItem) {
  const nextQuantity = getQuantityFromDraft(item);
  const safeOriginalQuantity = item.originalQuantity > 0 ? item.originalQuantity : 1;
  const multiplier = nextQuantity > 0 ? nextQuantity / safeOriginalQuantity : 0;

  return {
    ...item,
    calories: String(roundMacroValue(item.originalCalories * multiplier)),
    protein: String(roundMacroValue(item.originalProtein * multiplier)),
    carbs: String(roundMacroValue(item.originalCarbs * multiplier)),
    fat: String(roundMacroValue(item.originalFat * multiplier)),
  };
}

function buildLoggedFollowUp(mealType: string, items: CoachFoodItem[]) {
  const names = items.map((item) => formatFoodName(item.name).toLowerCase());

  if (names.some((name) => /salmon|sardine|mackerel|walnut|flax/.test(name))) {
    return `That ${mealType} has something going for it. Foods like that are rich in omega-3s, which can support mood and focus by calming inflammation in the brain.`;
  }
  if (names.some((name) => /yogurt|kefir|kimchi|sauerkraut|kombucha/.test(name))) {
    return `There is something strong in that ${mealType}. Fermented foods support gut diversity, which can help energy and mood feel steadier over time.`;
  }
  if (names.some((name) => /oat|bean|lentil|apple|berry|broccoli/.test(name))) {
    return `That ${mealType} brings in fiber, which matters more than it gets credit for. It can help with steadier energy, digestion, and a more even mood.`;
  }
  if (names.some((name) => /egg|chicken|turkey|tofu|greek yogurt|cottage cheese/.test(name))) {
    return `That ${mealType} has a solid protein base, which can help with steadier energy, focus, and fewer crashy feelings later on.`;
  }
  if (names.some((name) => /avocado|olive|nut|seed|peanut butter|almond butter/.test(name))) {
    return `There is some satisfying fuel in that ${mealType}. Healthy fats like those can help with fullness, focus, and more grounded energy.`;
  }
  return `There is still something good in that ${mealType}. Getting the meal logged at all gives us something real to learn from, and that matters.`;
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
  const profile = useAppStore((state) => state.profile);
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
  const [adjustDraftItems, setAdjustDraftItems] = useState<AdjustDraftItem[]>([]);
  const starterOpacity = useRef(new Animated.Value(1)).current;
  const starterRise = useRef(new Animated.Value(0)).current;
  const coachUnitOptions = useMemo(
    () => getCoachUnitOptions(profile?.preferredUnits),
    [profile?.preferredUnits]
  );

  useEffect(() => {
    setDraft("");
    setPendingProposal(null);
    setAdjustModalVisible(false);
    setAdjustDraftItems([]);

    starterOpacity.setValue(0);
    starterRise.setValue(18);
    Animated.parallel([
      Animated.timing(starterOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(starterRise, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }),
    ]).start();
  }, [conversationResetCount, starterOpacity, starterRise]);

  const shouldShowStarter = useMemo(() => conversation.length === 0, [conversation]);

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

  const updateDraftItem = (index: number, updates: Partial<AdjustDraftItem>) => {
    setAdjustDraftItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextItem = { ...item, ...updates };
        return nextItem.mode === "serving" ? scaleDraftFromServing(nextItem) : nextItem;
      })
    );
  };

  const setDraftMode = (index: number, mode: "serving" | "macros") => {
    setAdjustDraftItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextItem = {
          ...item,
          mode,
        };

        return mode === "serving" ? scaleDraftFromServing(nextItem) : nextItem;
      })
    );
  };

  const openAdjustModal = () => {
    if (!pendingProposal) return;
    setAdjustDraftItems(
      pendingProposal.items.map((item) => ({
        name: formatFoodName(item.name),
        quantityWhole: getQuantityParts(item.quantity).whole,
        quantityFraction: getQuantityParts(item.quantity).fraction,
        unit: coachUnitOptions.includes(item.unit) ? item.unit : "serving",
        calories: String(Math.round(item.calories)),
        protein: String(Math.round(item.protein)),
        carbs: String(Math.round(item.carbs)),
        fat: String(Math.round(item.fat)),
        mode: "serving",
        showUnitPicker: false,
        originalQuantity: item.quantity,
        originalCalories: item.calories,
        originalProtein: item.protein,
        originalCarbs: item.carbs,
        originalFat: item.fat,
      }))
    );
    setAdjustModalVisible(true);
  };

  const applyAdjustment = () => {
    if (!pendingProposal || adjustDraftItems.length === 0) return;
    const updatedItems = pendingProposal.items.map((item, index) => {
      const draftItem = adjustDraftItems[index];
      if (!draftItem) {
        return item;
      }

      const parsedQuantity = getQuantityFromDraft(draftItem);
      const nextQuantity = parsedQuantity > 0 ? parsedQuantity : item.quantity;
      const nextUnit = coachUnitOptions.includes(draftItem.unit) ? draftItem.unit : item.unit;
      return {
        ...item,
        name: formatFoodName(draftItem.name.trim() || item.name),
        quantity: nextQuantity,
        unit: nextUnit,
        portion: `${formatQuantityLabel(draftItem.quantityWhole, draftItem.quantityFraction)} ${nextUnit}`,
        calories: Number(draftItem.calories) || item.calories,
        protein: Number(draftItem.protein) || item.protein,
        carbs: Number(draftItem.carbs) || item.carbs,
        fat: Number(draftItem.fat) || item.fat,
      };
    });
    const updatedProposal = { ...pendingProposal, items: updatedItems };
    setPendingProposal(updatedProposal);
    setAdjustModalVisible(false);
    setAdjustDraftItems([]);
  };

  return (
    <View style={styles.stack}>
      <Modal transparent animationType="fade" visible={shouldShowStarter}>
        <View style={styles.starterModalBackdrop}>
          <Animated.View
            style={[
              styles.starterModalCard,
              {
                opacity: starterOpacity,
                transform: [{ translateY: starterRise }],
              },
            ]}
          >
            <SectionTitle
              eyebrow="Start Here"
              title="What would feel most supportive right now?"
              subtitle="These are just gentle starting points. We can move anywhere from there."
            />
            <Text style={styles.starterLead}>New conversation</Text>
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
          </Animated.View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={adjustModalVisible}
        onRequestClose={() => setAdjustModalVisible(false)}
      >
        <View style={styles.adjustModalBackdrop}>
          <View style={styles.adjustModalSheet}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#2C1A0E" }}>Food Macros</Text>
            <ScrollView
              style={styles.adjustScroll}
              contentContainerStyle={styles.adjustScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {adjustDraftItems.map((item, itemIndex) => (
                <View key={`${item.name}-${itemIndex}`} style={styles.adjustItemCard}>
                  <View style={styles.adjustItemHeader}>
                    <Text style={styles.adjustItemTitle}>
                      {formatFoodName(item.name)}{" "}
                      <Text style={styles.adjustItemServingInline}>
                        ({formatQuantityLabel(item.quantityWhole, item.quantityFraction)} {item.unit})
                      </Text>
                    </Text>
                    <Text style={styles.adjustItemMacroSummary}>
                      {item.calories} cal | {item.protein}p | {item.carbs}c | {item.fat}f
                    </Text>
                  </View>
                  <View style={styles.adjustModeRow}>
                    <Pressable
                      onPress={() => setDraftMode(itemIndex, "serving")}
                      style={[styles.adjustModePill, item.mode === "serving" && styles.adjustModePillActive]}
                    >
                      <Text style={[styles.adjustModeText, item.mode === "serving" && styles.adjustModeTextActive]}>Serving</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDraftMode(itemIndex, "macros")}
                      style={[styles.adjustModePill, item.mode === "macros" && styles.adjustModePillActive]}
                    >
                      <Text style={[styles.adjustModeText, item.mode === "macros" && styles.adjustModeTextActive]}>Macros</Text>
                    </Pressable>
                  </View>
                  {item.mode === "serving" ? (
                    <>
                      <Text style={styles.adjustSectionLabel}>Serving size</Text>
                      <View style={styles.quantityWheelRow}>
                        <WheelPicker
                          label="Whole"
                          options={quantityWholeOptions}
                          selected={item.quantityWhole}
                          onSelect={(value) => updateDraftItem(itemIndex, { quantityWhole: value })}
                        />
                        <WheelPicker
                          label="Fraction"
                          options={quantityFractionOptions.map((option) => option.label)}
                          selected={item.quantityFraction}
                          onSelect={(value) => updateDraftItem(itemIndex, { quantityFraction: value })}
                        />
                      </View>
                      <View style={styles.adjustUnitRow}>
                        <Pressable
                          onPress={() =>
                            updateDraftItem(itemIndex, {
                              unit: "serving",
                              showUnitPicker: false,
                            })
                          }
                          style={[styles.unitShortcut, item.unit === "serving" && styles.unitShortcutActive]}
                        >
                          <Text style={[styles.unitShortcutText, item.unit === "serving" && styles.unitShortcutTextActive]}>Serving</Text>
                        </Pressable>
                        {item.unit !== "serving" ? (
                          <View style={[styles.unitShortcut, styles.unitShortcutActive]}>
                            <Text style={[styles.unitShortcutText, styles.unitShortcutTextActive]}>{item.unit}</Text>
                          </View>
                        ) : null}
                        <Pressable
                          onPress={() => updateDraftItem(itemIndex, { showUnitPicker: !item.showUnitPicker })}
                          style={styles.unitMoreButton}
                        >
                          <Text style={styles.unitMoreText}>{item.showUnitPicker ? "Hide other units" : "Other units"}</Text>
                        </Pressable>
                      </View>
                      {item.showUnitPicker ? (
                        <WheelPicker
                          label="Unit"
                          options={coachUnitOptions}
                          selected={item.unit}
                          onSelect={(value) => updateDraftItem(itemIndex, { unit: value as FoodUnit })}
                          compact
                        />
                      ) : null}
                      <View style={styles.adjustServingPreview}>
                        <Text style={styles.adjustServingPreviewBody}>
                          Serving changes automatically scale the estimated macros for this food.
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5 }}>Name</Text>
                      <TextInput
                        value={item.name}
                        onChangeText={(text) => updateDraftItem(itemIndex, { name: text })}
                        style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                      />
                      <Text style={styles.adjustMacroHint}>Macro mode lets you fine-tune nutrition directly without changing serving size.</Text>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Calories</Text>
                          <TextInput
                            value={item.calories}
                            onChangeText={(text) => updateDraftItem(itemIndex, { calories: text })}
                            keyboardType="numeric"
                            style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Protein (g)</Text>
                          <TextInput
                            value={item.protein}
                            onChangeText={(text) => updateDraftItem(itemIndex, { protein: text })}
                            keyboardType="numeric"
                            style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Carbs (g)</Text>
                          <TextInput
                            value={item.carbs}
                            onChangeText={(text) => updateDraftItem(itemIndex, { carbs: text })}
                            keyboardType="numeric"
                            style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: "#7A6155", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Fat (g)</Text>
                          <TextInput
                            value={item.fat}
                            onChangeText={(text) => updateDraftItem(itemIndex, { fat: text })}
                            keyboardType="numeric"
                            style={{ borderWidth: 1, borderColor: "rgba(44,26,14,0.1)", borderRadius: 14, padding: 12, fontSize: 16, color: "#2C1A0E", backgroundColor: "#FFFFFF" }}
                          />
                        </View>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.adjustFooter}>
              <Pressable
                onPress={applyAdjustment}
                style={styles.adjustSaveButton}
              >
                <Text style={styles.adjustSaveButtonText}>Save changes</Text>
              </Pressable>
              <Pressable
                onPress={() => setAdjustModalVisible(false)}
                style={styles.adjustCancelButton}
              >
                <Text style={styles.adjustCancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
                        <Pressable onPress={() => openAdjustModal()}>
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
                    onPress={() => openAdjustModal()}
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

function WheelPicker({
  label,
  options,
  selected,
  onSelect,
  compact = false,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.wheelWrap, compact && styles.wheelWrapCompact]}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <View style={styles.wheelViewport}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          snapToInterval={36}
          decelerationRate="fast"
          contentContainerStyle={styles.wheelContent}
        >
          {options.map((option) => {
            const active = option === selected;
            return (
              <Pressable
                key={`${label}-${option}`}
                onPress={() => onSelect(option)}
                style={[styles.wheelOption, active && styles.wheelOptionActive]}
              >
                <Text style={[styles.wheelOptionText, active && styles.wheelOptionTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
  starterModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(44, 26, 14, 0.18)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  starterModalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  starterLead: {
    color: colors.accentPrimary,
    fontSize: 17,
    fontWeight: "600",
  },
  adjustModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(44,26,14,0.4)",
    padding: 12,
  },
  adjustModalSheet: {
    flex: 1,
    backgroundColor: "#FAF7F2",
    borderRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.1)",
    gap: 16,
  },
  adjustScroll: {
    flex: 1,
  },
  adjustScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  adjustItemCard: {
    backgroundColor: "#FFFCF8",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
    padding: spacing.md,
    gap: spacing.sm,
  },
  adjustItemHeader: {
    gap: 6,
    paddingBottom: 2,
  },
  adjustItemTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  adjustItemServingInline: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  adjustItemMacroSummary: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  adjustModeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  adjustModePill: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adjustModePillActive: {
    backgroundColor: "#F6DFC9",
    borderColor: colors.accentPrimary,
  },
  adjustModeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  adjustModeTextActive: {
    color: colors.accentPrimary,
  },
  adjustSectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quantityWheelRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  adjustUnitRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  unitShortcut: {
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitShortcutActive: {
    backgroundColor: "#F6DFC9",
    borderColor: colors.accentPrimary,
  },
  unitShortcutText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  unitShortcutTextActive: {
    color: colors.accentPrimary,
  },
  unitMoreButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  unitMoreText: {
    color: colors.accentPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  adjustServingPreview: {
    backgroundColor: "#FFF5EC",
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.12)",
  },
  adjustServingPreviewTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  adjustServingPreviewBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  adjustFooter: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  adjustSaveButton: {
    backgroundColor: "#C4622D",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  adjustSaveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  adjustCancelButton: {
    alignItems: "center",
    padding: 8,
  },
  adjustCancelButtonText: {
    color: "#7A6155",
    fontSize: 15,
  },
  adjustMacroHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  wheelWrap: {
    flex: 1,
    gap: 6,
  },
  wheelWrapCompact: {
    flex: 0,
  },
  wheelLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  wheelViewport: {
    height: 132,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  wheelContent: {
    paddingVertical: 12,
  },
  wheelOption: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  wheelOptionActive: {
    backgroundColor: "#F6DFC9",
  },
  wheelOptionText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
  },
  wheelOptionTextActive: {
    color: colors.accentPrimary,
    fontWeight: "700",
  },
});
