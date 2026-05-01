// components/coach.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Animated,
  FlatList,
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

type CoachDisplayMessage = AiConversationMessage & { id: string };
type CoachResponsePart = {
  type: "paragraph" | "bullet" | "numbered";
  content: string;
  number?: number;
};
type CoachStarter = {
  emoji: string;
  title: string;
  subtitle: string;
  prompt: string;
};

const COACH_CONNECTION_FALLBACK = "Having trouble connecting right now. Try again in a moment.";

function extractReplyFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        const nestedReply = extractReplyFromUnknown(parsed);
        if (nestedReply) {
          return nestedReply;
        }
      } catch {}

      const match = trimmed.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match?.[1]) {
        return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
      }
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => extractReplyFromUnknown(entry))
      .find((entry) => entry.length > 0) ?? "";
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return (
      extractReplyFromUnknown(record.reply) ||
      extractReplyFromUnknown(record.content) ||
      extractReplyFromUnknown(record.message) ||
      extractReplyFromUnknown(record.choices)
    );
  }

  return "";
}

function detectIntent(message: string): "food_log" | "conversation" {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return "conversation";
  }

  const conversationStarters = [
    "why",
    "what",
    "how",
    "when",
    "where",
    "who",
    "should",
    "can",
    "could",
    "would",
    "do",
    "does",
    "did",
    "is",
    "are",
    "am",
    "will",
    "tell me",
    "explain",
    "help me",
    "give me",
    "suggest",
    "recommend",
    "i need help",
    "i just need to talk",
  ];

  if (
    normalized.includes("?") ||
    conversationStarters.some((starter) => normalized.startsWith(starter))
  ) {
    return "conversation";
  }

  const foodLogPatterns = [
    /\b(i had|i ate|ate|had|logged|log|tracking|for breakfast|for lunch|for dinner|for a snack|breakfast was|lunch was|dinner was|snack was)\b/,
    /\b\d+\s*(eggs?|egg|toast|banana|bananas|cups?|cup|oz|ounces?|g|grams?|slices?|slice|pieces?|piece|tbsp|tsp)\b/,
    /\b(my breakfast|my lunch|my dinner|my snack)\b/,
  ];

  return foodLogPatterns.some((pattern) => pattern.test(normalized))
    ? "food_log"
    : "conversation";
}

function MessageBubble({
  message,
  pendingProposal,
  confirming,
  showSuggestedReplies,
  onOpenGutFeedback,
  onConfirmProposal,
  onOpenAdjustModal,
  onUpdateProposalMealType,
  onPopulateDraft,
}: {
  message: CoachDisplayMessage;
  pendingProposal: CoachFoodProposal | null;
  confirming: boolean;
  showSuggestedReplies: boolean;
  onOpenGutFeedback: (item: CoachFoodItem) => Promise<void>;
  onConfirmProposal: () => Promise<void>;
  onOpenAdjustModal: () => void;
  onUpdateProposalMealType: (meal: MealType) => void;
  onPopulateDraft: (text: string) => void;
}) {
  const proposalIsActive = Boolean(
    pendingProposal && message.foodProposal && message.foodProposal.sourceMessage === pendingProposal.sourceMessage
  );
  const proposalItems = proposalIsActive ? pendingProposal?.items ?? [] : message.foodProposal?.items ?? [];
  const proposalMealType = proposalIsActive
    ? pendingProposal?.mealType
    : message.foodProposal?.mealType;
  const assistantText = extractReply(message.content).trim() || message.content.trim() || "Something went wrong. Try again.";
  const responseParts = parseCoachResponse(assistantText);
  const suggestedReplies = message.role === "assistant" ? getSuggestedReplies(message) : [];

  return (
    <View style={styles.messageWrap}>
      <View
        style={[
          styles.bubble,
          message.role === "user" ? styles.userBubble : styles.assistantBubble,
          message.id === "welcome" && styles.welcomeBubble,
        ]}
      >
        {message.role === "assistant" ? (
          <View style={styles.bubbleHeaderRow}>
            <View style={styles.coachIconChip}>
              <Ionicons name="sparkles" size={12} color={colors.accentPrimary} />
            </View>
            <Text style={message.id === "welcome" ? styles.welcomeCoachLabel : styles.coachLabel}>SavorSelf Coach</Text>
          </View>
        ) : null}
        {message.role === "user" ? (
          <Text style={[styles.responseText, styles.standaloneResponseText, styles.userResponseText]}>
            {message.content}
          </Text>
        ) : responseParts.length > 0 ? (
          <View style={styles.bubbleContent}>
            <View style={styles.responseTextWrap}>
              {responseParts.map((part, index) => (
                <View
                  key={`${message.id}-part-${index}`}
                  style={[styles.responsePart, index === responseParts.length - 1 && styles.responsePartLast]}
                >
                  {part.type === "numbered" ? (
                    <View style={styles.numberCircle}>
                      <Text style={styles.numberText}>{part.number}</Text>
                    </View>
                  ) : null}
                  {part.type === "bullet" ? <View style={styles.bulletDot} /> : null}
                  <Text selectable style={[styles.responseText, styles.partResponseText]}>
                    {part.content}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text selectable style={[styles.responseText, styles.standaloneResponseText]}>
            {assistantText}
          </Text>
        )}
      </View>
      <Text style={[styles.messageTime, message.role === "user" ? styles.messageTimeUser : styles.messageTimeAssistant]}>
        {format(new Date(message.timestamp), "h:mm a")}
      </Text>

      {message.role === "assistant" && message.foodProposal ? (
        <View style={styles.proposalBubble}>
          <Text style={styles.proposalEyebrow}>✦ Got it — adding to your log</Text>
          {proposalItems.map((item) => (
            <View key={`${message.id}-${item.name}`} style={styles.proposalItemWrap}>
              <Pressable
                onPress={() => void onOpenGutFeedback(item)}
                style={({ pressed }) => [styles.proposalItemCard, pressed && styles.promptPressed]}
              >
                <View style={styles.proposalEmojiBox}>
                  <Text style={styles.proposalEmojiText}>🍽</Text>
                </View>
                <View style={styles.proposalItemContent}>
                  <Text style={styles.proposalItemTitle}>{formatFoodName(item.name)}</Text>
                  <Text style={styles.proposalItemMacroSummary}>
                    {Math.round(item.calories)} cal · {Math.round(item.protein)}g protein · {Math.round(item.carbs)}g carbs
                  </Text>
                  <View style={styles.proposalTagRow}>
                    {getFoodHighlightTags(item).map((tag) => (
                      <View
                        key={`${item.name}-${tag.label}`}
                        style={[
                          styles.proposalTag,
                          tag.tone === "sage"
                            ? styles.proposalTagSage
                            : tag.tone === "amber"
                              ? styles.proposalTagAmber
                              : styles.proposalTagTerracotta,
                        ]}
                      >
                        <Text
                          style={[
                            styles.proposalTagText,
                            tag.tone === "sage"
                              ? styles.proposalTagTextSage
                              : tag.tone === "amber"
                                ? styles.proposalTagTextAmber
                                : styles.proposalTagTextTerracotta,
                          ]}
                        >
                          {tag.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            </View>
          ))}
          <View style={styles.proposalDivider} />
          <Text style={styles.proposalTotalText}>
            Total: {Math.round(proposalItems.reduce((sum, item) => sum + item.calories, 0))} cal ·{" "}
            {Math.round(proposalItems.reduce((sum, item) => sum + item.protein, 0))}g protein
          </Text>
          {proposalIsActive && proposalMealType ? (
            <>
              <View style={styles.proposalMealRow}>
                {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((meal) => (
                  <Pressable
                    key={meal}
                    style={[
                      styles.proposalMealChip,
                      proposalMealType === meal && styles.proposalMealChipActive,
                    ]}
                    onPress={() => onUpdateProposalMealType(meal)}
                  >
                    <Text
                      style={[
                        styles.proposalMealChipText,
                        proposalMealType === meal && styles.proposalMealChipTextActive,
                      ]}
                    >
                      {meal.charAt(0).toUpperCase() + meal.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.proposalActionRow}>
                <Pressable
                  onPress={() => void onConfirmProposal()}
                  style={({ pressed }) => [
                    styles.proposalActionButton,
                    styles.proposalConfirmButton,
                    pressed && styles.promptPressed,
                  ]}
                >
                  {confirming ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={[styles.proposalActionText, styles.proposalConfirmText]}>Confirm</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={onOpenAdjustModal}
                  style={({ pressed }) => [
                    styles.proposalActionButton,
                    styles.proposalSecondaryButton,
                    pressed && styles.promptPressed,
                  ]}
                >
                  <Text style={[styles.proposalActionText, styles.proposalSecondaryText]}>Edit</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {message.role === "assistant" && showSuggestedReplies && suggestedReplies.length > 0 ? (
        <View style={styles.replyChipRow}>
          {suggestedReplies.map((reply) => (
            <Pressable
              key={`${message.id}-${reply}`}
              onPress={() => onPopulateDraft(reply)}
              style={({ pressed }) => [styles.replyChip, pressed && styles.promptPressed]}
            >
              <Text style={styles.replyChipText}>{reply}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function extractReply(content: string): string {
  return extractReplyFromUnknown(content);
}

function parseCoachResponse(text: string): CoachResponsePart[] {
  if (!text || text.trim() === "") {
    return [];
  }

  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [{ type: "paragraph", content: text }];
  }

  return lines.map((line) => {
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      return {
        type: "numbered" as const,
        content: numberedMatch[2],
        number: Number.parseInt(numberedMatch[1], 10),
      };
    }
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return {
        type: "bullet" as const,
        content: line.replace(/^[-•]\s+/, ""),
      };
    }
    return {
      type: "paragraph" as const,
      content: line,
    };
  });
}

function buildConfirmationMessage(proposal: CoachFoodProposal): string {
  const items = proposal.items
    .map((item) => `• ${formatFoodName(item.name)}`)
    .join("\n");
  const totalCal = proposal.items.reduce((sum, item) => sum + (item.calories ?? 0), 0);
  const totalProtein = proposal.items.reduce((sum, item) => sum + (item.protein ?? 0), 0);

  return `Logged to ${proposal.mealType} ✓\n\n${items}\n\n${Math.round(totalCal)} cal · ${Math.round(totalProtein)}g protein`;
}

function getFoodHighlightTags(item: CoachFoodItem) {
  const tags: Array<{ label: string; tone: "sage" | "amber" | "terracotta" }> = [];

  if ((item.fiber ?? 0) >= 5) {
    tags.push({ label: `${Math.round(item.fiber ?? 0)}g fiber`, tone: "sage" });
  }
  if ((item.protein ?? 0) >= 15) {
    tags.push({ label: `${Math.round(item.protein ?? 0)}g protein`, tone: "sage" });
  }
  if ((item.calories ?? 0) >= 450) {
    tags.push({ label: "heavier meal", tone: "amber" });
  }
  if (item.foodSource === "ai_estimate") {
    tags.push({ label: "AI estimate", tone: "terracotta" });
  }

  return tags.slice(0, 3);
}

function getSuggestedReplies(message: CoachDisplayMessage): string[] {
  if (message.foodProposal) {
    return ["Yes please 🌱", "Not now", "What's my dip pattern?"];
  }

  if (message.kind === "status") {
    return ["Yes please 🌱", "Not now", "What's my dip pattern?"];
  }

  return [];
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

const moodLabels = ["Low", "Okay", "Neutral", "Good", "Great"] as const;

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

function getFollowUpSuggestion(mealType: MealType, calories: number): string | null {
  const hour = new Date().getHours();
  if (mealType === "breakfast" && calories < 400) {
    return "That's a lighter breakfast — want me to suggest something to add?";
  }
  if (mealType === "lunch" && hour > 14) {
    return "Late lunch logged! Want a lighter dinner suggestion?";
  }
  if (mealType === "dinner" && calories > 800) {
    return "Big dinner — a short walk after can help digestion. Want any tips?";
  }
  return null;
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
  const flatListRef = useRef<FlatList<CoachDisplayMessage> | null>(null);
  const thinkingDotsOpacity = useRef(new Animated.Value(0.3)).current;
  const coachUnitOptions = useMemo(
    () => getCoachUnitOptions(profile?.preferredUnits),
    [profile?.preferredUnits]
  );
  const hour = new Date().getHours();
  const inputPlaceholder = "Tell your coach...";

  useEffect(() => {
    setDraft("");
    setPendingProposal(null);
    setAdjustModalVisible(false);
    setAdjustDraftItems([]);
  }, [conversationResetCount]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
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
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const moodLogged =
    moodLogs.length > 0 &&
    moodLogs[0]?.loggedAt?.slice(0, 10) === todayKey;
  const hasFoodToday = foodLogs.some((food) => food.loggedAt.slice(0, 10) === todayKey);
  const hasMoodToday = moodLogs.length > 0 && moodLogs[0].loggedAt.slice(0, 10) === todayKey;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Hey" : "Good evening";
  const avatarGreeting = profile?.avatarEmoji ? `${profile.avatarEmoji} ` : "";
  const welcomeText = moodLogged
    ? `${avatarGreeting}${greeting}${profile?.name ? `, ${profile.name}` : ""}! I can see you've already checked in today — feeling ${moodLabels[(moodLogs[0]?.moodScore ?? 3) - 1]?.toLowerCase() ?? "it"}. What's on your mind?`
    : `${avatarGreeting}${greeting}${profile?.name ? `, ${profile.name}` : ""}! I'm your SavorSelf coach. I can log your food, pull up your patterns, or just talk. What do you need today?`;
  const starters = useMemo<CoachStarter[]>(
    () =>
      [
        {
          emoji: "🍳",
          title: hour < 11 ? "Log breakfast" : hour < 15 ? "Log lunch" : "Log dinner",
          subtitle: "Describe what you had and I'll find the nutrition",
          prompt: hour < 11 ? "I want to log breakfast" : hour < 15 ? "I want to log lunch" : "I want to log dinner",
        },
        !hasMoodToday
          ? {
              emoji: "💭",
              title: "How am I feeling?",
              subtitle: "Tell me and I'll help make sense of it",
              prompt: "I want to talk about how I'm feeling today",
            }
          : {
              emoji: "📊",
              title: "How's my mood been?",
              subtitle: "I'll pull your recent patterns and give you a read",
              prompt: "How has my mood been lately?",
            },
        hasFoodToday
          ? {
              emoji: "🥗",
              title: "What should I eat next?",
              subtitle: "Based on what you've had so far today",
              prompt: "What should I eat next based on what I've logged today?",
            }
          : {
              emoji: "🌱",
              title: "What should I eat today?",
              subtitle: "Get a suggestion based on your gut-brain goals",
              prompt: "What should I eat to support my mood today?",
            },
        {
          emoji: "💬",
          title: "Just talk",
          subtitle: "No food stuff — a supportive space to think out loud",
          prompt: "I just need to talk through something",
        },
      ].filter((item): item is CoachStarter => Boolean(item)),
    [hasFoodToday, hasMoodToday, hour]
  );
  const displayConversation = useMemo<CoachDisplayMessage[]>(
    () =>
      conversation.length === 0
        ? [
            {
              id: "welcome",
              role: "assistant" as const,
              content: welcomeText,
              createdAt: new Date().toISOString(),
              timestamp: new Date().toISOString(),
              kind: "text",
            },
          ]
        : conversation.map((message, index) => ({
            ...message,
            id: `${message.timestamp}-${index}`,
          })),
    [conversation, welcomeText]
  );
  const memorySummary = useMemo(() => {
    const parts = [
      profile?.onboardingGoal ? `goal: ${profile.onboardingGoal}` : null,
      profile?.onboardingChallenge ? `challenge: ${profile.onboardingChallenge}` : null,
      profile?.preferredUnits ? `units: ${profile.preferredUnits}` : null,
    ].filter(Boolean);

    return parts.join(" · ") || "your food goals, mood patterns, and how you like to track.";
  }, [profile?.onboardingChallenge, profile?.onboardingGoal, profile?.preferredUnits]);

  const coachContext = useMemo(
    () => ({
      profileName: profile?.name ?? "",
      onboardingGoal: profile?.onboardingGoal ?? "",
      onboardingChallenge: profile?.onboardingChallenge ?? "",
      moodLogs: moodLogs.slice(-7),
      todaysMood: moodLogs[0]
        ? {
            score: moodLogs[0].moodScore,
            energy: moodLogs[0].energyScore,
            physicalStates: moodLogs[0].physicalState,
            mentalStates: moodLogs[0].mentalState,
            note: moodLogs[0].notes,
          }
        : null,
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
    [foodLogs, insights, moodLogs, profile?.name, profile?.onboardingChallenge, profile?.onboardingGoal, quickLogs]
  );

  const updateProposalMealType = (meal: MealType) => {
    if (pendingProposal) {
      setPendingProposal({ ...pendingProposal, mealType: meal });
    }
  };

  const appendAssistant = (
    content: string,
    kind: "text" | "food_summary" | "clarification" | "status" = "text",
    foodProposal?: CoachFoodProposal
  ) => {
    const replyText = extractReply(content);
    addCoachMessage({
      role: "assistant",
      content: replyText?.trim() ? replyText : "Something went wrong. Try again.",
      timestamp: new Date().toISOString(),
      kind,
      foodProposal,
    });
  };

  const handleSend = async (messageOverride?: string) => {
    const message = (messageOverride ?? draft).trim();
    if (!message || sending) return;
    const intent = detectIntent(message);
    const history = conversation
      .filter((m: AiConversationMessage) => m.content.length < 400)
      .slice(-6)
      .map((m: AiConversationMessage) => ({ role: m.role, content: m.content }));
    addCoachMessage({ role: "user", content: message, timestamp: new Date().toISOString() });
    setDraft("");
    setSending(true);
    try {
      if (intent === "conversation") {
        const fallback = await sendCoachMessage(message, coachContext, history);
        appendAssistant(fallback.reply || "I'm here with you.", "text");
        return;
      }

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
          appendAssistant(COACH_CONNECTION_FALLBACK, "status");
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

    const result = await saveMultipleFoodLogs(mappedItems);

    setConfirming(false);

    if (result.error) {
      appendAssistant(result.error, "status");
      return;
    }

    const suggestion = getFollowUpSuggestion(
      proposalToSave.mealType,
      proposalToSave.items.reduce((sum, item) => sum + (item.calories ?? 0), 0)
    );
    appendAssistant(buildConfirmationMessage(proposalToSave), "status");
    setPendingProposal(null);
    if (suggestion) {
      setTimeout(() => {
        appendAssistant(suggestion, "text");
      }, 800);
    }
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
      <FlatList
        ref={flatListRef}
        style={styles.messagesScroll}
        data={displayConversation}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            pendingProposal={pendingProposal}
            confirming={confirming}
            showSuggestedReplies={item.id === displayConversation[displayConversation.length - 1]?.id}
            onOpenGutFeedback={openGutFeedback}
            onConfirmProposal={confirmProposal}
            onOpenAdjustModal={openAdjustModal}
            onUpdateProposalMealType={updateProposalMealType}
            onPopulateDraft={setDraft}
          />
        )}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <>
            {sending ? (
              <View style={styles.messageWrap}>
                <View style={[styles.bubble, styles.assistantBubble, styles.thinkingBubble]}>
                  <View style={styles.bubbleHeaderRow}>
                    <View style={styles.coachIconChip}>
                      <Ionicons name="sparkles" size={12} color={colors.accentPrimary} />
                    </View>
                    <Text style={styles.coachLabel}>SavorSelf Coach</Text>
                  </View>
                  <View style={styles.thinkingDotsRow}>
                    {[0, 1, 2].map((dot) => (
                      <Animated.View
                        key={`thinking-dot-${dot}`}
                        style={[
                          styles.thinkingDot,
                          {
                            opacity: thinkingDotsOpacity.interpolate({
                              inputRange: [0.3, 1],
                              outputRange: [0.35 + dot * 0.08, 0.85 + dot * 0.05],
                            }),
                            transform: [
                              {
                                translateY: thinkingDotsOpacity.interpolate({
                                  inputRange: [0.3, 1],
                                  outputRange: [dot === 1 ? 2 : 4, dot === 1 ? -4 : -2],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.thinkingText}>Coach is thinking...</Text>
                </View>
              </View>
            ) : null}

            {!hasStartedConversation ? (
              <View style={styles.promptRow}>
                <Text style={styles.promptTitle}>What I can help with</Text>
                <View style={styles.starterCards}>
                  {starters.map((item) => (
                    <Pressable
                      key={item.prompt}
                      onPress={() => {
                        setDraft(item.prompt);
                      }}
                      style={({ pressed }) => [styles.starterCard, pressed && styles.promptPressed]}
                    >
                      <View style={styles.starterCardRow}>
                        <View style={styles.starterEmojiCircle}>
                          <Text style={styles.starterEmoji}>{item.emoji}</Text>
                        </View>
                        <View style={styles.starterCardCopy}>
                          <Text style={styles.starterCardTitle}>{item.title}</Text>
                          <Text style={styles.starterCardSubtitle}>{item.subtitle}</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        }
      />

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
            placeholder={inputPlaceholder}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => void handleSend()}
          />
        </View>
        <Pressable style={({ pressed }) => [styles.attachButton, pressed && styles.promptPressed]} onPress={() => {}}>
          <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
        </Pressable>
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
  chatShell: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  coachHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFCF8",
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconButtonAccent: {
    backgroundColor: "rgba(196,98,45,0.08)",
    borderColor: "rgba(196,98,45,0.16)",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#2C1A0E",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  memoryCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#FFFCF8",
    borderWidth: 1,
    borderColor: "rgba(196,98,45,0.15)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memoryIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(196,98,45,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  memoryCopy: {
    flex: 1,
  },
  memoryText: {
    color: "#7A6155",
    fontSize: 13,
    lineHeight: 18,
  },
  memoryTextStrong: {
    color: "#2C1A0E",
    fontWeight: "700",
  },
  memoryAction: {
    color: "#C4622D",
    fontSize: 13,
    fontWeight: "700",
  },
  messagesScroll: { flex: 1 },
  messagesContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 28,
    gap: spacing.sm,
    flexGrow: 1,
  },
  messageWrap: {
    gap: 6,
    width: "100%",
    minWidth: 0,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 0,
    overflow: "visible",
    flexShrink: 1,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: "#C4622D",
    borderTopRightRadius: 6,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    backgroundColor: "rgba(196,98,45,0.10)",
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(196,98,45,0.15)",
  },
  welcomeBubble: {
    maxWidth: "92%",
    paddingHorizontal: 16,
  },
  bubbleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  coachIconChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(196,98,45,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeCoachLabel: {
    fontSize: 11,
    color: "#C4622D",
    fontWeight: "700",
    letterSpacing: 0.45,
  },
  coachLabel: {
    fontSize: 11,
    color: "#C4622D",
    fontWeight: "700",
    letterSpacing: 0.45,
  },
  messageTime: {
    fontSize: 11,
    color: "#9B857A",
    opacity: 0.85,
  },
  messageTimeUser: {
    alignSelf: "flex-end",
    paddingRight: 6,
  },
  messageTimeAssistant: {
    alignSelf: "flex-start",
    paddingLeft: 6,
  },
  bubbleContent: {
    width: "100%",
    minWidth: 0,
  },
  responseTextWrap: {
    width: "100%",
    minWidth: 0,
  },
  responsePart: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
    width: "100%",
  },
  responsePartLast: {
    marginBottom: 0,
  },
  numberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#C4622D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  numberText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C4622D",
    marginTop: 8,
    flexShrink: 0,
  },
  responseText: {
    fontSize: 15.5,
    lineHeight: 24,
    color: "#2C1A0E",
    flexShrink: 1,
    minWidth: 0,
    flexWrap: "wrap",
  },
  partResponseText: {
    flex: 1,
  },
  standaloneResponseText: {
    minWidth: 0,
    alignSelf: "stretch",
  },
  userResponseText: {
    color: "#FFFFFF",
  },
  replyChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignSelf: "flex-start",
    maxWidth: "92%",
  },
  replyChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFCF8",
    borderWidth: 1,
    borderColor: "rgba(196,98,45,0.25)",
  },
  replyChipText: {
    color: "#C4622D",
    fontSize: 13,
    fontWeight: "500",
  },
  promptRow: { gap: 10, marginTop: spacing.md },
  promptTitle: {
    color: "#9B857A",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  starterCards: {
    gap: 10,
  },
  promptPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  starterCard: {
    backgroundColor: "#FFFCF8",
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.08)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  starterCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  starterEmojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(196,98,45,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  starterEmoji: {
    fontSize: 18,
  },
  starterCardCopy: {
    flex: 1,
    gap: 4,
  },
  starterCardTitle: {
    color: "#2C1A0E",
    fontSize: 18,
    fontWeight: "600",
  },
  starterCardSubtitle: {
    color: "#7A6155",
    fontSize: 13.5,
    lineHeight: 19,
  },
  optionCard: {
    backgroundColor: "#FFFCF8",
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.08)",
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
  },
  optionTitle: { color: "#2C1A0E", fontSize: 17, fontWeight: "600" },
  optionBody: { color: "#7A6155", fontSize: 15, lineHeight: 24 },
  proposalBubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    backgroundColor: "#FFFCF8",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(196,98,45,0.15)",
    padding: 14,
    gap: 10,
  },
  proposalEyebrow: {
    color: "#C4622D",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  proposalItemWrap: {
    gap: 8,
  },
  proposalItemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.08)",
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  proposalEmojiBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(196,98,45,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  proposalEmojiText: {
    fontSize: 18,
  },
  proposalItemContent: {
    flex: 1,
    gap: 6,
  },
  proposalItemTitle: {
    color: "#2C1A0E",
    fontSize: 16,
    fontWeight: "700",
  },
  proposalItemMacroSummary: {
    color: "#7A6155",
    fontSize: 13,
    lineHeight: 18,
  },
  proposalTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  proposalTag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  proposalTagSage: {
    backgroundColor: "rgba(138,158,123,0.14)",
  },
  proposalTagAmber: {
    backgroundColor: "rgba(232,168,56,0.16)",
  },
  proposalTagTerracotta: {
    backgroundColor: "rgba(196,98,45,0.12)",
  },
  proposalTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  proposalTagTextSage: {
    color: "#5F7451",
  },
  proposalTagTextAmber: {
    color: "#9C6B11",
  },
  proposalTagTextTerracotta: {
    color: "#C4622D",
  },
  proposalDivider: {
    height: 1,
    backgroundColor: "rgba(44,26,14,0.08)",
  },
  proposalTotalText: {
    color: "#2C1A0E",
    fontSize: 14,
    fontWeight: "600",
  },
  proposalMealRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  proposalMealChip: {
    minWidth: "47%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.08)",
  },
  proposalMealChipActive: {
    backgroundColor: "rgba(196,98,45,0.10)",
    borderColor: "#C4622D",
  },
  proposalMealChipText: {
    fontSize: 13,
    color: "#2C1A0E",
    fontWeight: "500",
  },
  proposalMealChipTextActive: {
    color: "#C4622D",
    fontWeight: "700",
  },
  proposalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  proposalActionButton: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  proposalConfirmButton: {
    backgroundColor: "#C4622D",
  },
  proposalSecondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C4622D",
  },
  proposalActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  proposalConfirmText: {
    color: "#FFFFFF",
  },
  proposalSecondaryText: {
    color: "#C4622D",
  },
  thinkingBubble: {
    gap: 8,
  },
  thinkingDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  thinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C4622D",
  },
  thinkingText: {
    color: "#9B857A",
    fontSize: 12.5,
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
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: "#FAF7F2",
    gap: 10,
    boxShadow: "0 -10px 24px rgba(44, 26, 14, 0.06)",
  },
  charCount: {
    fontSize: 11,
    color: "#9B857A",
    textAlign: "right",
    paddingRight: spacing.md,
    paddingBottom: 4,
  },
  charCountWarning: {
    color: colors.accentPrimary,
  },
  inputFieldWrap: {
    flex: 1,
    backgroundColor: "#FFFCF8",
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.08)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 15.5,
    color: "#2C1A0E",
    maxHeight: 120,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFCF8",
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#C4622D",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(196,98,45,0.32)",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
});
