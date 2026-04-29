// components/coach.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GutScoreModal, type GutScoreData } from "@/components/GutScoreModal";
import { colors, radii, spacing } from "@/constants/theme";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { formatFoodName } from "@/lib/utils";
import { parseFoodMessage, sendCoachMessage } from "@/services/coach";
import { useAppStore, type AppState } from "@/store/useAppStore";
import type { AiConversationMessage, CoachFoodItem, CoachFoodProposal, FoodMoodInsight, FoodUnit, MealType } from "@/types/models";

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

function extractReply(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.reply === "string" && parsed.reply.trim()) {
        return parsed.reply.trim();
      }
    } catch {}
    const match = trimmed.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (match?.[1]) {
      return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    return "";
  }
  return content;
}

const quantityWholeOptions = Array.from({ length: 13 }, (_, index) => String(index));
const quantityFractionOptions = [
  { label: "0", value: 0 },
  { label: "1/4", value: 0.25 },
  { label: "1/3", value: 1 / 3 },
  { label: "1/2", value: 0.5 },
  { label: "2/3", value: 2 / 3 },
  { label: "3/4", value: 0.75 },
] as const;

function estimateMicronutrients(foodName: string) {
  const name = foodName.toLowerCase();
  const patterns = [
    { score: 18, terms: ["salmon", "sardine", "mackerel", "tuna", "herring", "anchovies", "trout", "halibut", "sea bass", "mahi"] },
    { score: 16, terms: ["spinach", "kale", "broccoli", "arugula", "collard", "chard", "beet green", "watercress", "bok choy", "mustard green"] },
    { score: 16, terms: ["yogurt", "kefir", "kimchi", "sauerkraut", "miso", "tempeh", "kombucha", "natto", "lassi"] },
    { score: 12, terms: ["walnut", "almond", "chia", "flax", "hemp", "pumpkin seed", "sunflower seed", "brazil nut", "pecan", "cashew", "pistachio"] },
    { score: 12, terms: ["lentil", "chickpea", "black bean", "kidney bean", "edamame", "pea", "fava", "mung bean", "navy bean", "pinto"] },
    { score: 10, terms: ["oat", "quinoa", "farro", "amaranth", "millet", "buckwheat", "barley", "teff", "bulgur", "sorghum"] },
    { score: 10, terms: ["blueberry", "strawberry", "raspberry", "blackberry", "pomegranate", "acai", "goji", "cranberry", "cherry", "fig"] },
    { score: 8, terms: ["egg", "eggs"] },
    { score: 8, terms: ["avocado", "olive oil", "coconut oil", "ghee"] },
    { score: 8, terms: ["sweet potato", "butternut squash", "pumpkin", "carrot", "beet", "parsnip"] },
    { score: 7, terms: ["mushroom", "shiitake", "maitake", "reishi", "oyster mushroom"] },
    { score: 6, terms: ["chicken", "turkey", "lean beef", "bison", "venison", "lamb"] },
    { score: 5, terms: ["tofu", "soy milk", "edamame"] },
    { score: 8, terms: ["apple", "pear", "orange", "banana", "mango", "grape", "watermelon", "peach", "plum"] },
    { score: 6, terms: ["brown rice", "whole wheat", "whole grain", "rye bread", "sourdough"] },
    { score: -6, terms: ["white rice", "white bread", "cracker", "bagel", "white pasta", "flour tortilla"] },
    { score: -12, terms: ["hot dog", "deli meat", "bologna", "salami", "pepperoni", "spam", "bacon bits"] },
    { score: -18, terms: ["chips", "cookie", "cake", "candy", "soda", "fries", "donut", "pop tart", "cheez-it", "oreo", "cheetos", "doritos", "skittles", "gummy", "twizzler", "snickers", "kit kat", "m&m"] },
    { score: -12, terms: ["fast food", "mcdonald", "burger king", "wendy", "taco bell", "kfc", "popeyes", "jack in the box"] },
  ];

  for (const pattern of patterns) {
    if (pattern.terms.some((term) => name.includes(term))) {
      return pattern.score;
    }
  }

  return 0;
}

function computeGutScore(food: {
  foodName?: string;
  fiberG: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  gutHealthTags: string[];
  foodSource: string;
}) {
  let score = 52;
  score += Math.min(food.fiberG * 2, 14);
  score += Math.min(food.proteinG * 0.25, 8);
  if (food.gutHealthTags.includes("fermented") || food.gutHealthTags.includes("probiotic")) {
    score += 8;
  }
  if (food.gutHealthTags.includes("anti_inflammatory")) {
    score += 6;
  }
  if (food.gutHealthTags.includes("high_fiber")) {
    score += 5;
  }
  if (food.gutHealthTags.includes("processed")) {
    score -= 10;
  }
  score += estimateMicronutrients(food.foodName ?? "");
  return Math.round(Math.min(100, Math.max(0, score)));
}

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

function guessMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snack";
  return "dinner";
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

function buildLocalGutFeedback(item: CoachFoodItem, score: number) {
  const name = formatFoodName(item.name);
  if (score >= 75) {
    return `${name} looks pretty supportive. Foods like that usually bring a steadier mix of nourishment for digestion, energy, and mood.`;
  }
  if (score >= 55) {
    return `${name} lands in a middle zone. There is some support there, especially if it is part of a more balanced meal.`;
  }
  if (score >= 40) {
    return `${name} looks a little more mixed. It can fit just fine, but it may not do as much heavy lifting for steadier mood or gut comfort on its own.`;
  }
  return `${name} may feel a little rougher on steady energy or digestion. That is useful to notice without turning it into judgment.`;
}

function buildGutScoreData(item: CoachFoodItem, score: number, summary: string): GutScoreData {
  const tags: GutScoreData["tags"] = [];

  if ((item.fiber ?? 0) >= 5) {
    tags.push({ label: "High fiber", tone: "green" });
  }
  if (item.protein >= 15) {
    tags.push({ label: "Protein support", tone: "green" });
  }
  if (item.carbs >= 35 || item.fat >= 18) {
    tags.push({ label: "Heavier load", tone: "amber" });
  }
  if (tags.length === 0) {
    tags.push({ label: score >= 55 ? "Mixed support" : "Gentle caution", tone: score >= 55 ? "green" : "amber" });
  }

  return {
    foodName: formatFoodName(item.name),
    score,
    summary,
    tags,
    insights: [
      {
        category: "Digestion",
        body: `${Math.round(item.fiber ?? 0)}g fiber can shape how steady or comfortable this food feels in your gut.`,
      },
      {
        category: "Mood",
        body: `${Math.round(item.protein)}g protein, ${Math.round(item.carbs)}g carbs, and ${Math.round(item.fat)}g fat can influence how even your energy and mood feel afterward.`,
      },
      {
        category: "Energy",
        body: "This score is a gentle estimate, not a judgment. It helps highlight what may feel steadier versus heavier in your body.",
      },
    ],
  };
}

export function CoachChat() {
  const conversation = useAppStore((state: AppState) => state.conversation);
  const conversationResetCount = useAppStore((state: AppState) => state.conversationResetCount);
  const profile = useAppStore((state: AppState) => state.profile);
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const quickLogs = useAppStore((state: AppState) => state.quickLogs);
  const insights = useAppStore((state: AppState) => state.insights);
  const loadFoodMoodInsights = useAppStore((state: AppState) => state.loadFoodMoodInsights);
  const addCoachMessage = useAppStore((state: AppState) => state.addCoachMessage);
  const saveMultipleFoodLogs = useAppStore((state: AppState) => state.saveMultipleFoodLogs);

  const [draft, setDraft] = useState("");
  const [pendingProposal, setPendingProposal] = useState<CoachFoodProposal | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [gutScoreData, setGutScoreData] = useState<GutScoreData | null>(null);
  const [proposalGutScores, setProposalGutScores] = useState<Record<string, number>>({});
  const [proposalGutScoreLoading, setProposalGutScoreLoading] = useState<Record<string, boolean>>({});
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustDraftItems, setAdjustDraftItems] = useState<AdjustDraftItem[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const thinkingDotsOpacity = useRef(new Animated.Value(0.3)).current;
  const coachUnitOptions = useMemo(
    () => getCoachUnitOptions(profile?.preferredUnits),
    [profile?.preferredUnits]
  );

  useEffect(() => {
    setDraft("");
    setPendingProposal(null);
    setAdjustModalVisible(false);
    setAdjustDraftItems([]);
  }, [conversationResetCount]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [conversation.length, sending]);

  useEffect(() => {
    if (!sending) {
      thinkingDotsOpacity.stopAnimation();
      thinkingDotsOpacity.setValue(0.3);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(thinkingDotsOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(thinkingDotsOpacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [sending, thinkingDotsOpacity]);

  const hasStartedConversation = conversation.length > 0;
  const displayConversation = useMemo<Array<AiConversationMessage & { id?: string; createdAt?: string }>>(
    () =>
      conversation.length === 0
        ? [
            {
              id: "welcome",
              role: "assistant" as const,
              content:
                "Hey! I'm your SavorSelf coach. I can log your food just from a description, pull up your mood patterns, suggest what to eat based on your gut-brain data, or just talk through how you're feeling. What's on your mind?",
              createdAt: new Date().toISOString(),
              timestamp: new Date().toISOString(),
              kind: "text",
            },
          ]
        : conversation,
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
      insights: insights.slice(0, 3),
    }),
    [foodLogs, insights, moodLogs, quickLogs]
  );

  const appendAssistant = (
    content: string,
    kind: "text" | "food_summary" | "clarification" | "status" = "text",
    foodProposal?: CoachFoodProposal
  ) => {
    const replyText = extractReply(content);
    addCoachMessage({
      role: "assistant",
      content: replyText?.trim() ? replyText : "Something went wrong, try again.",
      timestamp: new Date().toISOString(),
      kind,
      foodProposal,
    });
  };

  const handleSend = async (messageOverride?: string) => {
    const message = (messageOverride ?? draft).trim();
    if (!message || sending) return;
    const history = conversation
      .filter((m: AiConversationMessage) => m.content.length < 400)
      .slice(-6)
      .map((m: AiConversationMessage) => ({ role: m.role, content: m.content }));
    addCoachMessage({ role: "user", content: message, timestamp: new Date().toISOString() });
    setDraft("");
    setSending(true);
    try {
      const result = await parseFoodMessage({ message, pendingProposal, history, context: coachContext });
      if (
        !result?.intent &&
        (!result?.reply || /hit a snag|try again/i.test(result.reply))
      ) {
        const fallback = await sendCoachMessage(message, coachContext, history);
        appendAssistant(fallback.reply || "I'm here with you.", "text");
        return;
      }

      switch (result.intent) {
        case "food_log": {
          if (result.items?.length) {
            const proposal: CoachFoodProposal = {
              isFoodLogging: true,
              needsClarification: false,
              mealType: result.mealType ?? pendingProposal?.mealType ?? guessMealType(),
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
          appendAssistant(result.reply ?? "", "clarification");
          break;
        default:
          if (!result.reply || /hit a snag|try again/i.test(result.reply)) {
            const fallback = await sendCoachMessage(message, coachContext, history);
            appendAssistant(fallback.reply || "I'm here with you.", "text");
          } else {
            appendAssistant(result.reply || "I'm here with you.", "text");
          }
          break;
      }
    } catch (error) {
      try {
        const fallback = await sendCoachMessage(message, coachContext, history);
        appendAssistant(fallback.reply || "I'm here with you.", "text");
      } catch {
        appendAssistant("I'm here with you.", "text");
      }
    } finally {
      setSending(false);
    }
  };

  const confirmProposal = async () => {
    if (!pendingProposal) return;

    setConfirming(true);
    const proposalToSave = pendingProposal;
    const mappedItems = proposalToSave.items.map((item) => ({
      foodName: item.name,
      foodSource: item.foodSource,
      externalFoodId: item.externalFoodId,
      mealType: proposalToSave.mealType,
      quantity: item.quantity ?? 0,
      unit: item.unit,
      calories: item.calories ?? 0,
      proteinG: item.protein ?? 0,
      carbsG: item.carbs ?? 0,
      fatG: item.fat ?? 0,
      fiberG: item.fiber ?? 0,
      sugarG: item.sugar ?? 0,
    }));
    console.log("[coach] saveMultipleFoodLogs payload", mappedItems);

    const result = await saveMultipleFoodLogs(mappedItems);

    setConfirming(false);

    if (result.error) {
      appendAssistant(result.error, "status");
      return;
    }

    appendAssistant(`Logged to your ${proposalToSave.mealType}. ✓`, "status");
    setPendingProposal(null);
  };

  const openInsights = async () => {
    await loadFoodMoodInsights();
    const latestInsights = useAppStore.getState().insights.slice(0, 3);
    addCoachMessage({
      role: "assistant",
      content:
        latestInsights.length > 0
          ? `Here's what stands out right now:\n\n${latestInsights.map((i: FoodMoodInsight) => `• ${i.insightBody}`).join("\n")}`
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

  const openGutFeedback = async (item: CoachFoodItem) => {
    const gutScoreKey = item.name.toLowerCase();
    const fallbackScore = computeGutScore({
      foodName: item.name,
      fiberG: item.fiber ?? 0,
      proteinG: item.protein,
      fatG: item.fat,
      carbsG: item.carbs,
      gutHealthTags: [],
      foodSource: item.foodSource,
    });

    setGutScoreData({
      foodName: formatFoodName(item.name),
      score: fallbackScore,
      tags: [],
      summary: "Loading...",
      insights: [
        { category: "Energy", body: "" },
        { category: "Mood", body: "" },
        { category: "Digestion", body: "" },
      ],
    });

    try {
      setProposalGutScoreLoading((prev) => ({ ...prev, [gutScoreKey]: true }));
      setProposalGutScores((prev) => {
        const next = { ...prev };
        delete next[gutScoreKey];
        return next;
      });
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "gut_score",
          message: `gut_score: ${item.name}`,
          history: [],
          context: {},
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (data?.intent === "gut_score" && data?.score != null) {
        const parsedScore = Math.min(Math.max(Number(data.score), 0), 100);
        const insightsArray: { category: string; body: string }[] = Array.isArray(data.insights) ? data.insights : [];
        const findInsight = (cat: string) => insightsArray.find((i) => i.category?.toLowerCase() === cat.toLowerCase())?.body ?? "";
        setGutScoreData({
          foodName: formatFoodName(data.foodName ?? item.name),
          score: parsedScore,
          tags: Array.isArray(data.tags) ? data.tags.map((t: any) => ({
            label: t.label ?? "",
            tone: t.sentiment === "positive" ? "green" : "amber",
          })) : [],
          summary: typeof data.summary === "string" ? data.summary : "",
          insights: [
            { category: "Energy", body: findInsight("energy") },
            { category: "Mood", body: findInsight("mood") },
            { category: "Digestion", body: findInsight("digestion") },
          ],
        });
        setProposalGutScores((prev) => ({ ...prev, [item.name.toLowerCase()]: parsedScore }));
      }
    } catch {
    } finally {
      setProposalGutScoreLoading((prev) => ({ ...prev, [gutScoreKey]: false }));
    }
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.chatShell}
      keyboardVerticalOffset={90}
    >
      <View style={styles.chatShell}>
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

      <GutScoreModal visible={Boolean(gutScoreData)} data={gutScoreData} onClose={() => setGutScoreData(null)} />
      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {displayConversation.map((message, index) => (
          <View key={`${message.timestamp}-${index}`} style={styles.messageWrap}>
            <View
              style={[
                styles.bubble,
                message.role === "user" ? styles.userBubble : styles.assistantBubble,
                message.id === "welcome" && styles.welcomeBubble,
              ]}
            >
              {message.id === "welcome" ? (
                <Text style={styles.welcomeCoachLabel}>✦ SavorSelf Coach</Text>
              ) : null}
              <Text style={[styles.bubbleText, message.role === "user" && styles.userBubbleText]}>
                {extractReply(message.content)}
              </Text>
            </View>
            <Text style={[styles.messageTime, message.role === "user" ? styles.messageTimeUser : styles.messageTimeAssistant]}>
              {format(new Date(message.timestamp), "h:mm a")}
            </Text>

            {message.role === "assistant" && message.foodProposal ? (
              <View style={styles.proposalBubble}>
                <Text style={styles.proposalEyebrow}>Food proposal</Text>
                {(pendingProposal && message.foodProposal.sourceMessage === pendingProposal.sourceMessage
                  ? pendingProposal.items
                  : message.foodProposal.items
                ).map((item) => (
                  <View key={`${message.timestamp}-${item.name}`} style={styles.proposalItemWrap}>
                    <Pressable
                      onPress={() => void openGutFeedback(item)}
                      style={({ pressed }) => [styles.proposalItemRow, pressed && styles.promptPressed]}
                    >
                      <Text style={styles.proposalItemText}>
                        • {formatFoodName(item.name)}  {Math.round(item.calories)} cal
                      </Text>
                    </Pressable>
                    {item.foodSource === "ai_estimate" ? (
                      <Text style={styles.proposalMetaText}>AI estimate</Text>
                    ) : null}
                  </View>
                ))}
                <View style={styles.proposalDivider} />
                <Text style={styles.proposalTotalText}>
                  Total:{" "}
                  {Math.round(
                    (pendingProposal && message.foodProposal.sourceMessage === pendingProposal.sourceMessage
                      ? pendingProposal.items
                      : message.foodProposal.items
                    ).reduce((sum, item) => sum + item.calories, 0)
                  )}{" "}
                  cal ·{" "}
                  {Math.round(
                    (pendingProposal && message.foodProposal.sourceMessage === pendingProposal.sourceMessage
                      ? pendingProposal.items
                      : message.foodProposal.items
                    ).reduce((sum, item) => sum + item.protein, 0)
                  )}g protein
                </Text>
                {pendingProposal && message.foodProposal.sourceMessage === pendingProposal.sourceMessage ? (
                  <View style={styles.proposalActionRow}>
                    <Pressable
                      onPress={() => void confirmProposal()}
                      style={({ pressed }) => [
                        styles.proposalActionButton,
                        styles.proposalConfirmButton,
                        pressed && styles.promptPressed,
                      ]}
                    >
                      {confirming ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={[styles.proposalActionText, styles.proposalConfirmText]}>Log it ✓</Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => openAdjustModal()}
                      style={({ pressed }) => [
                        styles.proposalActionButton,
                        styles.proposalSecondaryButton,
                        pressed && styles.promptPressed,
                      ]}
                    >
                      <Text style={[styles.proposalActionText, styles.proposalSecondaryText]}>Not quite</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}

        {sending ? (
          <View style={styles.messageWrap}>
            <View style={[styles.bubble, styles.assistantBubble, styles.thinkingBubble]}>
              <Animated.Text style={[styles.thinkingDots, { opacity: thinkingDotsOpacity }]}>···</Animated.Text>
              <Text style={styles.thinkingText}>thinking...</Text>
            </View>
          </View>
        ) : null}

        {!hasStartedConversation ? (
          <View style={styles.promptRow}>
            <Text style={styles.promptTitle}>What I can help with</Text>
            <View style={styles.starterCards}>
              {[
                {
                  title: "🍳  Log what I ate",
                  subtitle: "Just describe it naturally — I'll find the nutrition and add it to your log",
                  prompt: "I want to log what I ate",
                },
                {
                  title: "📊  How's my mood been?",
                  subtitle: "I'll pull your recent patterns and give you a personal read",
                  prompt: "How has my mood been lately?",
                },
                {
                  title: "🥗  What should I eat?",
                  subtitle: "Get a suggestion based on your gut-brain goals and recent logs",
                  prompt: "What should I eat to support my mood today?",
                },
                {
                  title: "💬  Just talk",
                  subtitle: "No food stuff required — a supportive space to think out loud",
                  prompt: "I just need to talk through something",
                },
              ].map((item) => (
                <Pressable
                  key={item.prompt}
                  onPress={() => {
                    setDraft(item.prompt);
                    void handleSend(item.prompt);
                  }}
                  style={({ pressed }) => [styles.starterCard, pressed && styles.promptPressed]}
                >
                  <Text style={styles.starterCardTitle}>{item.title}</Text>
                  <Text style={styles.starterCardSubtitle}>{item.subtitle}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {draft.length > 400 ? (
        <Text style={[styles.charCount, draft.length > 450 && styles.charCountWarning]}>
          {draft.length}/500
        </Text>
      ) : null}

      <View style={styles.inputBar}>
        <View style={styles.inputFieldWrap}>
          <TextInput
            style={styles.inputField}
            value={draft}
            onChangeText={setDraft}
            placeholder="Log food or ask anything..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => void handleSend()}
          />
        </View>
        <Pressable
          style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
          onPress={() => void handleSend()}
          disabled={!draft.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.sendButtonText}>↑</Text>}
        </Pressable>
      </View>
      </View>
    </KeyboardAvoidingView>
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
  chatShell: { flex: 1 },
  messagesScroll: { flex: 1 },
  messagesContent: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: 16,
  },
  messageWrap: { gap: spacing.sm },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: "80%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentPrimary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  welcomeBubble: {
    backgroundColor: "#F6EDE4",
    borderColor: "#E8C9AE",
  },
  welcomeCoachLabel: {
    fontSize: 11,
    color: colors.accentPrimary,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
    opacity: 0.7,
  },
  messageTimeUser: {
    alignSelf: "flex-end",
  },
  messageTimeAssistant: {
    alignSelf: "flex-start",
  },
  bubbleText: { color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
  userBubbleText: { color: colors.white },
  promptRow: { gap: spacing.sm, marginTop: spacing.sm },
  promptTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  starterCards: {
    gap: 10,
    marginTop: 8,
  },
  promptPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  starterCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  starterCardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  starterCardSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
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
  proposalBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#F6EDE4",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: "88%",
    borderWidth: 1,
    borderColor: "#E8C9AE",
    gap: 8,
  },
  proposalEyebrow: {
    color: colors.accentPrimary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    fontWeight: "600",
  },
  proposalItemWrap: {
    gap: 3,
  },
  proposalItemRow: {
    alignSelf: "flex-start",
    borderRadius: 12,
  },
  proposalItemText: {
    color: colors.textPrimary,
    fontSize: 15,
    paddingVertical: 3,
  },
  proposalMetaText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  proposalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  proposalTotalText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  proposalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  proposalActionButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  proposalConfirmButton: {
    backgroundColor: colors.accentPrimary,
  },
  proposalSecondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
  },
  proposalActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  proposalConfirmText: {
    color: colors.white,
  },
  proposalSecondaryText: {
    color: colors.accentPrimary,
  },
  thinkingBubble: {
    gap: 4,
  },
  thinkingDots: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 24,
  },
  thinkingText: {
    color: colors.textSecondary,
    fontSize: 12,
    opacity: 0.6,
  },
  modalFeedbackCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: "30%",
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
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    paddingBottom: 24,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  charCount: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "right",
    paddingRight: spacing.md,
    paddingBottom: 4,
  },
  charCountWarning: {
    color: colors.accentPrimary,
  },
  inputFieldWrap: {
    flex: 1,
    gap: 6,
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
    maxHeight: 120,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "600",
  },
});
