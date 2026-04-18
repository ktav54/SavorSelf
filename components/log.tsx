import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Chip, Field, PrimaryButton, SectionTitle } from "@/components/ui";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { formatFoodName } from "@/lib/utils";
import { searchFoodCatalog, type FoodSearchResult } from "@/services/usda";
import { useAppStore } from "@/store/useAppStore";
import type { FoodLog, FoodUnit, MealType, MentalState, MoodLog, PhysicalState } from "@/types/models";

const moodOptions = [
  { score: 1, emoji: "1", label: "Low" },
  { score: 2, emoji: "2", label: "Okay" },
  { score: 3, emoji: "3", label: "Good" },
  { score: 4, emoji: "4", label: "Great" },
  { score: 5, emoji: "5", label: "Amazing" },
] as const;

const physicalOptions: PhysicalState[] = [
  "bloated",
  "energized",
  "foggy",
  "strong",
  "tired",
  "sore",
  "light",
  "heavy",
];

const mentalOptions: MentalState[] = [
  "anxious",
  "content",
  "overwhelmed",
  "calm",
  "motivated",
  "irritable",
  "focused",
  "scattered",
];

const mealOptions: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

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
    { score: 4, terms: ["tofu", "soy milk", "edamame"] },
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
  fiberG: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  calories: number;
  gutHealthTags: string[];
  foodName: string;
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
  score += estimateMicronutrients(food.foodName);
  return Math.min(Math.max(Math.round(score), 0), 100);
}

async function fetchAiGutScore(
  foodName: string,
  fiberG: number,
  proteinG: number,
  fatG: number,
  carbsG: number,
  calories: number
): Promise<number> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `You are a gut-brain axis nutritionist with deep knowledge of psychobiotics, the microbiome-mood connection, and nutritional psychiatry. Score this food from 0-100 for its gut-brain health impact using this rubric:

90-100: Exceptional. High fiber, rich micronutrients, strong probiotic or prebiotic value, anti-inflammatory, supports serotonin/dopamine precursors. Examples: wild salmon, kimchi, kefir, walnuts, lentils, blueberries.
70-89: Strong. Good fiber or protein, meaningful micronutrients, low processing. Examples: eggs, oats, sweet potato, Greek yogurt, almonds, broccoli, chicken breast.
50-69: Neutral to moderate. Some nutritional value but limited gut-brain benefit. Examples: white rice, banana, cheddar cheese, whole wheat bread.
30-49: Low value. Minimal fiber, micronutrients, or gut benefit. May cause blood sugar spikes. Examples: bagel, orange juice, low-fiber crackers.
10-29: Poor. Ultra-processed, high sugar or refined carbs, inflammatory, disrupts microbiome diversity. Examples: potato chips, cookies, fast food, sugary cereal.
0-9: Actively harmful. Highest processing, artificial additives, trans fats, extreme sugar. Examples: candy, soda, deep-fried snacks, energy drinks.

Food: "${foodName}"
Supporting macros per serving: ${calories} kcal, ${fiberG}g fiber, ${proteinG}g protein, ${fatG}g fat, ${carbsG}g carbs.

Reason about: whole food vs processed, likely micronutrient density, microbiome diversity impact, tryptophan/tyrosine content, inflammation potential, blood sugar stability.

Return ONLY a single integer 0-100. No words, no explanation, no punctuation. Just the number.`,
        context: {},
      }),
    });
    const data = await response.json().catch(() => ({}));
    const match = String(data?.reply).match(/\d+/);
    const score = match ? Math.min(Math.max(parseInt(match[0]), 0), 100) : null;
    if (score === null) {
      throw new Error("Invalid score");
    }
    return score;
  } catch {
    return computeGutScore({
      fiberG,
      proteinG,
      fatG,
      carbsG,
      calories,
      gutHealthTags: [],
      foodName,
    });
  }
}

function buildLocalGutFeedback(
  foodName: string,
  score: number,
  macros: { fiberG: number; proteinG: number; fatG: number; carbsG: number; calories: number }
) {
  const name = formatFoodName(foodName);
  if (score >= 75) {
    return `${name} looks pretty supportive today. It has more of the qualities that usually feel steadier for mood and digestion, especially when fiber, protein, or whole-food nutrients are part of the picture.`;
  }
  if (score >= 55) {
    return `${name} lands in a middle zone. There is some support here, but it may feel even steadier when it shows up alongside more fiber or protein.`;
  }
  if (score >= 40) {
    return `${name} looks a little more mixed. It can still fit into the day, but by itself it may feel lighter on gut support or steadier energy.`;
  }
  return `${name} may feel a little rougher on steady energy or digestion. That usually happens when a food is lower in fiber or protein, or more processed overall, and it is useful to notice without judging it.`;
}

export function GutScoreBadge({ score, onPress }: { score: number; onPress?: () => void }) {
  const backgroundColor =
    score >= 85
      ? "#2E7D32"
      : score >= 70
        ? "#66BB6A"
        : score >= 55
          ? "#FDD835"
          : score >= 40
            ? "#FB8C00"
            : score >= 25
              ? "#E53935"
              : "#B71C1C";
  const textColor = score >= 55 && score <= 69 ? colors.textPrimary : colors.white;
  const [barWidth, setBarWidth] = useState(0);

  const content = (
    <View style={styles.gutScoreWrap}>
      <View style={[styles.gutScoreBadge, { backgroundColor }]}>
        <Text style={[styles.gutScoreText, { color: textColor }]}>{score}</Text>
      </View>
      <View style={styles.gutSpectrumWrap} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
        {barWidth > 0 ? (
          <View style={[styles.gutSpectrumDot, { left: (score / 100) * barWidth - 4 }]} />
        ) : null}
        <View style={styles.gutSpectrumBar}>
          {["#B71C1C", "#E53935", "#FB8C00", "#FDD835", "#66BB6A", "#2E7D32"].map((color, index) => (
            <View key={`gut-band-${index}`} style={[styles.gutSpectrumSegment, { backgroundColor: color }]} />
          ))}
        </View>
      </View>
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

function getPreferredUnitOptions(preferredUnits?: "imperial" | "metric"): FoodUnit[] {
  if (preferredUnits === "metric") {
    return ["g", "ml", "serving", "piece"];
  }

  return ["oz", "fl_oz", "cup", "serving", "piece", "tbsp", "tsp"];
}
type MacroKey = "calories" | "protein" | "carbs" | "fat";

const macroDetails: Record<
  MacroKey,
  {
    label: string;
    unit: string;
    eyebrow: string;
    blurb: string;
    benefit: string;
    learnMoreTitle: string;
    sources: Array<{
      name: string;
      note: string;
      accent: string;
    }>;
  }
> = {
  calories: {
    label: "Calories",
    unit: "",
    eyebrow: "Energy",
    blurb: "Calories are your body's usable energy. They help power everything from basic brain function to movement and recovery.",
    benefit: "Looking at where your energy came from today can help you notice whether meals felt steady, light, or crash-prone.",
    learnMoreTitle: "Learn more about nourishing calorie sources",
    sources: [
      {
        name: "Oats + grains",
        note: "A steadier energy base, especially when paired with protein or fruit.",
        accent: "#F6DFC9",
      },
      {
        name: "Nuts + nut butters",
        note: "More calorie-dense, but they bring fiber and fats that can feel satisfying.",
        accent: "#F3E1A9",
      },
      {
        name: "Yogurt + dairy",
        note: "Often gives you calories with protein, which can feel more balanced.",
        accent: "#EEDFD7",
      },
    ],
  },
  protein: {
    label: "Protein",
    unit: "g",
    eyebrow: "Repair + Fullness",
    blurb: "Protein helps with muscle repair, steadier energy, and feeling satisfied after meals. It can also make a day of eating feel more grounded.",
    benefit: "A stronger protein base often supports steadier focus and can soften the up-and-down feeling that comes from carb-only meals.",
    learnMoreTitle: "Learn more about healthy protein sources",
    sources: [
      {
        name: "Eggs",
        note: "Easy, versatile protein with a strong nutrient payoff for a small serving.",
        accent: "#F8E9C6",
      },
      {
        name: "Greek yogurt",
        note: "A softer, high-protein option that can work well for breakfast or snacks.",
        accent: "#E6EFE1",
      },
      {
        name: "Chicken, tofu, fish",
        note: "Solid anchor foods when you want a meal to feel more steady and filling.",
        accent: "#F6DFC9",
      },
    ],
  },
  carbs: {
    label: "Carbs",
    unit: "g",
    eyebrow: "Fuel",
    blurb: "Carbs are one of your body's quickest energy sources, especially for the brain. They matter for mood, focus, and feeling mentally switched on.",
    benefit: "The type of carbs matters. More balanced, fiber-rich carbs tend to feel steadier than quick sugar spikes.",
    learnMoreTitle: "Learn more about steady carb sources",
    sources: [
      {
        name: "Fruit",
        note: "Brings quick energy, but also water and fiber depending on the fruit.",
        accent: "#F8E9C6",
      },
      {
        name: "Rice, oats, potatoes",
        note: "Comforting fuel sources that often feel best when paired with protein or fat.",
        accent: "#F6DFC9",
      },
      {
        name: "Beans + lentils",
        note: "A slower, fiber-rich carb source that can feel steadier through the day.",
        accent: "#E6EFE1",
      },
    ],
  },
  fat: {
    label: "Fat",
    unit: "g",
    eyebrow: "Hormones + Satisfaction",
    blurb: "Fat supports hormones, brain health, and helps meals feel more satisfying. It slows digestion a bit, which can make energy feel steadier.",
    benefit: "Fat can make meals feel more grounding and complete, especially when it shows up alongside protein and fiber.",
    learnMoreTitle: "Learn more about healthy fat sources",
    sources: [
      {
        name: "Avocado",
        note: "A gentle fat source that pairs well with meals without feeling too heavy.",
        accent: "#E6EFE1",
      },
      {
        name: "Nuts + seeds",
        note: "Small but powerful sources of fats, minerals, and texture.",
        accent: "#F3E1A9",
      },
      {
        name: "Salmon + olive oil",
        note: "Helpful for brain health and often a nice mood-supportive fat source.",
        accent: "#F6DFC9",
      },
    ],
  },
};

export function MoodCheckInStrip() {
  const moodLogs = useAppStore((state) => state.moodLogs);
  const moodLoading = useAppStore((state) => state.moodLoading);
  const moodError = useAppStore((state) => state.moodError);
  const saveMoodLog = useAppStore((state) => state.saveMoodLog);
  const todaysMood = moodLogs[0] ?? null;
  const [selectedMood, setSelectedMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [energyScore, setEnergyScore] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [note, setNote] = useState("");
  const [physicalState, setPhysicalState] = useState<PhysicalState[]>([]);
  const [mentalState, setMentalState] = useState<MentalState[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!todaysMood) {
      setSelectedMood(null);
      setEnergyScore(3);
      setPhysicalState([]);
      setMentalState([]);
      setNote("");
      setIsEditing(true);
      return;
    }

    setSelectedMood(todaysMood.moodScore);
    setEnergyScore(todaysMood.energyScore);
    setPhysicalState(todaysMood.physicalState);
    setMentalState(todaysMood.mentalState);
    setNote(todaysMood.notes ?? "");
    setIsEditing(false);
  }, [todaysMood]);

  const toggleTag = <T extends string,>(value: T, current: T[], setter: (next: T[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const submit = async () => {
    if (!selectedMood) {
      return;
    }

    const payload: Omit<MoodLog, "id" | "userId" | "loggedAt"> = {
      moodScore: selectedMood,
      energyScore,
      physicalState,
      mentalState,
      notes: note,
    };

    const result = await saveMoodLog(payload);
    if (!result.error) {
      setIsEditing(false);
    }
  };

  return (
    <Card>
      <SectionTitle
        eyebrow="Mood First"
        title="How are you feeling right now?"
        subtitle="A quick check-in gives Food-Mood the context it needs."
      />
      {todaysMood && !isEditing ? (
        <View style={styles.savedMoodWrap}>
          <View style={[styles.savedMoodBadge, { backgroundColor: `${colors.mood[todaysMood.moodScore]}20` }]}>
            <Text style={[styles.savedMoodScore, { color: colors.mood[todaysMood.moodScore] }]}>
              {todaysMood.moodScore} / 5
            </Text>
            <Text style={styles.savedMoodText}>Today's check-in is saved.</Text>
          </View>
          <PrimaryButton label="Update today's check-in" secondary onPress={() => setIsEditing(true)} />
        </View>
      ) : null}
      {(!todaysMood || isEditing) ? (
        <View style={styles.stack}>
          <View style={styles.rowWrap}>
            {moodOptions.map((option) => (
              <Pressable
                key={option.score}
                style={[
                  styles.moodButton,
                  selectedMood === option.score && {
                    borderColor: colors.mood[option.score],
                    backgroundColor: `${colors.mood[option.score]}20`,
                  },
                ]}
                onPress={() => setSelectedMood(option.score)}
              >
                <Text style={styles.moodEmoji}>{option.emoji}</Text>
                <Text style={styles.moodLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>Energy level</Text>
          <View style={styles.rowWrap}>
            {[1, 2, 3, 4, 5].map((score) => (
              <Chip
                key={score}
                label={String(score)}
                active={energyScore === score}
                onPress={() => setEnergyScore(score as 1 | 2 | 3 | 4 | 5)}
              />
            ))}
          </View>
          <Text style={styles.helper}>Physical state</Text>
          <View style={styles.rowWrap}>
            {physicalOptions.map((item) => (
              <Chip
                key={item}
                label={item}
                active={physicalState.includes(item)}
                onPress={() => toggleTag(item, physicalState, setPhysicalState)}
              />
            ))}
          </View>
          <Text style={styles.helper}>Mental state</Text>
          <View style={styles.rowWrap}>
            {mentalOptions.map((item) => (
              <Chip
                key={item}
                label={item}
                active={mentalState.includes(item)}
                onPress={() => toggleTag(item, mentalState, setMentalState)}
              />
            ))}
          </View>
          <Field
            label="Optional note"
            value={note}
            onChangeText={setNote}
            placeholder="Anything your body or mind wants to say?"
          />
          {moodError ? <Text style={styles.errorText}>{moodError}</Text> : null}
          <PrimaryButton label={moodLoading ? "Saving..." : "Save check-in"} onPress={() => void submit()} />
        </View>
      ) : null}
    </Card>
  );
}

export function MacroSummaryBar() {
  const profile = useAppStore((state) => state.profile);
  const foodLogs = useAppStore((state) => state.foodLogs);
  const [selectedMacro, setSelectedMacro] = useState<MacroKey | null>(null);

  const totals = useMemo(() => {
    const calories = foodLogs.reduce((sum, item) => sum + item.calories, 0);
    const protein = foodLogs.reduce((sum, item) => sum + item.proteinG, 0);
    const carbs = foodLogs.reduce((sum, item) => sum + item.carbsG, 0);
    const fat = foodLogs.reduce((sum, item) => sum + item.fatG, 0);

    return {
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    };
  }, [foodLogs]);

  const macroBreakdown = useMemo(() => {
    const buildRows = (macro: MacroKey) => {
      const getValue = (item: FoodLog) => {
        switch (macro) {
          case "calories":
            return item.calories;
          case "protein":
            return item.proteinG;
          case "carbs":
            return item.carbsG;
          case "fat":
            return item.fatG;
        }
      };

      const total = foodLogs.reduce((sum, item) => sum + getValue(item), 0);
      return foodLogs
        .map((item) => {
          const amount = Math.round(getValue(item));
          const share = total > 0 ? amount / total : 0;
          return {
            id: item.id,
            foodName: formatFoodName(item.foodName),
            amount,
            share,
            mealType: item.mealType,
          };
        })
        .filter((item) => item.amount > 0)
        .sort((left, right) => right.amount - left.amount);
    };

    return {
      calories: buildRows("calories"),
      protein: buildRows("protein"),
      carbs: buildRows("carbs"),
      fat: buildRows("fat"),
    };
  }, [foodLogs]);

  const dailyGutAnalysis = useMemo(() => {
    if (!foodLogs.length) {
      return {
        averageScore: 0,
        label: "Nothing logged yet",
        note: "Log a meal and we'll start building a read on how today’s food may be landing for mood, energy, and digestion.",
      };
    }

    const scores = foodLogs.map((item) =>
      computeGutScore({
        foodName: item.foodName,
        fiberG: item.fiberG,
        proteinG: item.proteinG,
        fatG: item.fatG,
        carbsG: item.carbsG,
        calories: item.calories,
        gutHealthTags: item.gutHealthTags,
      })
    );
    const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

    return {
      averageScore,
      label:
        averageScore >= 75
          ? "Steady support"
          : averageScore >= 55
            ? "Mixed but supportive"
            : averageScore >= 40
              ? "A little uneven"
              : "Could feel crashier",
      note:
        averageScore >= 75
          ? "Today’s foods look pretty supportive for steadier energy and a calmer gut."
          : averageScore >= 55
            ? "There’s some good support in today’s mix, with room to make the day feel even steadier."
            : averageScore >= 40
              ? "Today looks more mixed so far. A little more fiber or protein later could help balance it out."
              : "Today’s mix may land a little rougher on energy or digestion, which is useful to notice without judging it.",
    };
  }, [foodLogs]);

  return (
    <>
      <Card>
        <View style={styles.dailyGutHeader}>
          <View>
            <Text style={styles.dailyGutEyebrow}>Daily Gut Analysis</Text>
            <Text style={styles.dailyGutTitle}>{dailyGutAnalysis.label}</Text>
          </View>
          <GutScoreBadge score={dailyGutAnalysis.averageScore} />
        </View>
        <Text style={styles.dailyGutBody}>{dailyGutAnalysis.note}</Text>
      </Card>
      <View style={styles.macroGrid}>
        <MacroVisualCard
          label="Calories"
          value={totals.calories}
          goal={Math.round(profile?.dailyCalorieGoal ?? 0)}
          unit=""
          accent={colors.accentPrimary}
          tone="warm"
          onPress={() => setSelectedMacro("calories")}
        />
        <MacroVisualCard
          label="Protein"
          value={totals.protein}
          goal={Math.round(profile?.dailyProteinGoal ?? 0)}
          unit="g"
          accent={colors.accentSecondary}
          tone="sage"
          onPress={() => setSelectedMacro("protein")}
        />
        <MacroVisualCard
          label="Carbs"
          value={totals.carbs}
          goal={Math.round(profile?.dailyCarbsGoal ?? 0)}
          unit="g"
          accent={colors.accentTertiary}
          tone="amber"
          onPress={() => setSelectedMacro("carbs")}
        />
        <MacroVisualCard
          label="Fat"
          value={totals.fat}
          goal={Math.round(profile?.dailyFatGoal ?? 0)}
          unit="g"
          accent={colors.textPrimary}
          tone="ink"
          onPress={() => setSelectedMacro("fat")}
        />
      </View>
      <Modal visible={Boolean(selectedMacro)} animationType="slide" transparent onRequestClose={() => setSelectedMacro(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedMacro ? (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.macroModalHeading}>
                    <Text style={styles.macroModalEyebrow}>{macroDetails[selectedMacro].eyebrow}</Text>
                    <Text style={styles.macroModalTitle}>{macroDetails[selectedMacro].label}</Text>
                  </View>
                  <Pressable onPress={() => setSelectedMacro(null)} style={styles.modalCloseButton}>
                    <Text style={styles.modalCloseText}>X</Text>
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.macroModalScroll}>
                  <Text style={styles.macroModalBody}>{macroDetails[selectedMacro].blurb}</Text>
                  <Text style={styles.macroModalCallout}>{macroDetails[selectedMacro].benefit}</Text>
                  <View style={styles.macroDetailStat}>
                    <Text style={styles.macroDetailStatLabel}>Today's total</Text>
                    <Text style={styles.macroDetailStatValue}>
                      {totals[selectedMacro]}
                      {macroDetails[selectedMacro].unit ? ` ${macroDetails[selectedMacro].unit}` : ""}
                    </Text>
                  </View>
                  <View style={styles.breakdownSection}>
                    <Text style={styles.breakdownTitle}>Where it came from today</Text>
                    {macroBreakdown[selectedMacro].length ? (
                      macroBreakdown[selectedMacro].slice(0, 5).map((item) => (
                        <View key={item.id} style={styles.breakdownRow}>
                          <View style={styles.breakdownCopy}>
                            <View style={styles.breakdownTop}>
                              <Text style={styles.breakdownFood}>{item.foodName}</Text>
                              <Text style={styles.breakdownAmount}>
                                {item.amount}
                                {macroDetails[selectedMacro].unit ? ` ${macroDetails[selectedMacro].unit}` : ""}
                              </Text>
                            </View>
                            <Text style={styles.breakdownMeal}>{item.mealType}</Text>
                            <View style={styles.breakdownRail}>
                              <View
                                style={[
                                  styles.breakdownFill,
                                  {
                                    width: `${Math.max(item.share * 100, 8)}%`,
                                    backgroundColor:
                                      selectedMacro === "protein"
                                        ? colors.accentSecondary
                                        : selectedMacro === "carbs"
                                          ? colors.accentTertiary
                                          : selectedMacro === "fat"
                                            ? colors.textPrimary
                                            : colors.accentPrimary,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.breakdownShare}>{Math.round(item.share * 100)}% of today's {macroDetails[selectedMacro].label.toLowerCase()}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>Nothing logged for this one yet today.</Text>
                    )}
                  </View>
                  <View style={styles.learnMoreSection}>
                    <Text style={styles.learnMoreTitle}>{macroDetails[selectedMacro].learnMoreTitle}</Text>
                    <View style={styles.learnMoreGrid}>
                      {macroDetails[selectedMacro].sources.map((source) => (
                        <View key={source.name} style={styles.learnMoreCard}>
                          <View style={[styles.learnMoreSwatch, { backgroundColor: source.accent }]} />
                          <Text style={styles.learnMoreFood}>{source.name}</Text>
                          <Text style={styles.learnMoreNote}>{source.note}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

export function HydrationSummaryCard() {
  const profile = useAppStore((state) => state.profile);
  const quickLogs = useAppStore((state) => state.quickLogs);
  const waterOz = useMemo(
    () => quickLogs.reduce((sum, item) => sum + (item.waterOz ?? 0), 0),
    [quickLogs]
  );
  const isMetric = profile?.preferredUnits === "metric";
  const waterUnit = isMetric ? "ml" : "oz";
  const todayValue = Math.round(isMetric ? waterOz * 29.5735 : waterOz);
  const goalValue = Math.round(isMetric ? (profile?.dailyWaterGoal ?? 0) * 29.5735 : profile?.dailyWaterGoal ?? 0);
  const progress = goalValue > 0 ? Math.min(todayValue / goalValue, 1) : 0;

  return (
    <Card>
      <View style={styles.hydrationHeader}>
        <View>
          <Text style={styles.hydrationEyebrow}>Hydration</Text>
          <Text style={styles.hydrationTitle}>Water</Text>
        </View>
        <Text style={styles.hydrationTotal}>
          {todayValue} / {goalValue} {waterUnit}
        </Text>
      </View>
      <View style={styles.hydrationRail}>
        <View style={[styles.hydrationFill, { width: `${Math.max(progress * 100, 6)}%` }]} />
      </View>
      <Text style={styles.hydrationBody}>
        A little hydration support, tucked right under your meals so it stays easy to notice.
      </Text>
    </Card>
  );
}

export function FoodLogSection({ mealType, logs, onAddFood }: { mealType: FoodLog["mealType"]; logs: FoodLog[]; onAddFood?: () => void }) {
  const deleteFoodLog = useAppStore((state) => state.deleteFoodLog);
  const updateFoodLog = useAppStore((state) => state.updateFoodLog);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FoodLog | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const mealCalories = logs.reduce((sum, item) => sum + item.calories, 0);
  const mealProtein = logs.reduce((sum, item) => sum + item.proteinG, 0);
  const mealCarbs = logs.reduce((sum, item) => sum + item.carbsG, 0);
  const mealFat = logs.reduce((sum, item) => sum + item.fatG, 0);
  const mealPrompt =
    mealType === "snack"
      ? "Nothing here yet. Tap below to add a snack."
      : `Nothing here yet. Tap below to add ${mealType}.`;

  const editPreview = useMemo(() => {
    if (!editingItem) {
      return null;
    }

    const parsedQuantity = Number(editQuantity);
    if (!parsedQuantity || parsedQuantity <= 0) {
      return null;
    }

    const multiplier = parsedQuantity / Math.max(editingItem.quantity, 1);
    return {
      calories: roundNutrition(editingItem.calories * multiplier),
      proteinG: roundNutrition(editingItem.proteinG * multiplier),
      carbsG: roundNutrition(editingItem.carbsG * multiplier),
      fatG: roundNutrition(editingItem.fatG * multiplier),
      fiberG: roundNutrition(editingItem.fiberG * multiplier),
      sugarG: roundNutrition(editingItem.sugarG * multiplier),
    };
  }, [editQuantity, editingItem]);

  const openEditModal = (item: FoodLog) => {
    setEditingItem(item);
    setEditQuantity(String(item.quantity));
    setEditError("");
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditQuantity("");
    setEditSaving(false);
    setEditError("");
  };

  const confirmEdit = async () => {
    if (!editingItem || !editPreview) {
      setEditError("Enter a quantity greater than zero.");
      return;
    }

    setEditSaving(true);
    const result = await updateFoodLog(editingItem.id, {
      quantity: Number(editQuantity),
      calories: editPreview.calories,
      proteinG: editPreview.proteinG,
      carbsG: editPreview.carbsG,
      fatG: editPreview.fatG,
      fiberG: editPreview.fiberG,
      sugarG: editPreview.sugarG,
    });
    setEditSaving(false);

    if (result.error) {
      setEditError(result.error);
      return;
    }

    closeEditModal();
  };

  return (
    <>
      <Card>
        <View style={styles.sectionRow}>
          <Text style={styles.mealTitle}>{mealType[0].toUpperCase() + mealType.slice(1)}</Text>
          <View style={styles.mealTotalsWrap}>
            <Text style={styles.mealTotal}>{Math.round(mealCalories)} cal</Text>
            <Text style={styles.mealMacroSummary}>
              {Math.round(mealProtein)}p | {Math.round(mealCarbs)}c | {Math.round(mealFat)}f
            </Text>
          </View>
        </View>
        <View style={styles.sectionDivider} />
        {logs.length ? (
          logs.map((item, index) => (
            <View key={item.id} style={index < logs.length - 1 ? styles.rowDivider : undefined}>
              <SwipeableFoodRow
                item={item}
                deleting={deletingId === item.id}
                onEdit={() => openEditModal(item)}
                onDelete={async () => {
                  setDeletingId(item.id);
                  await deleteFoodLog(item.id);
                  setDeletingId(null);
                }}
              />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{mealPrompt}</Text>
        )}
        <Pressable style={styles.addMealButton} onPress={onAddFood}>
          <Text style={styles.addMealText}>Add to {mealType}</Text>
        </Pressable>
      </Card>
      <Modal visible={Boolean(editingItem)} animationType="slide" transparent onRequestClose={closeEditModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <SectionTitle
              eyebrow="Edit Food"
              title={formatFoodName(editingItem?.foodName ?? "Food")}
              subtitle="Adjust the logged quantity for this food and we'll scale today's macros with it."
            />
            <Field
              label={`Quantity (${editingItem?.unit ?? "serving"})`}
              value={editQuantity}
              onChangeText={setEditQuantity}
              placeholder="1"
            />
            {editPreview ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Updated nutrition</Text>
                <Text style={styles.foodMeta}>
                  {editPreview.calories} cal | {editPreview.proteinG}g protein | {editPreview.carbsG}g carbs | {editPreview.fatG}g fat
                </Text>
              </View>
            ) : null}
            {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
            <View style={styles.modalActions}>
              <PrimaryButton label="Cancel" secondary onPress={closeEditModal} />
              <PrimaryButton label={editSaving ? "Saving..." : "Save changes"} onPress={() => void confirmEdit()} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function FoodSearchCard({
  defaultMealType = "breakfast",
  visible = false,
  onRequestClose,
  title,
}: {
  defaultMealType?: MealType;
  visible?: boolean;
  onRequestClose?: () => void;
  title?: string;
}) {
  const saveFoodLog = useAppStore((state) => state.saveFoodLog);
  const foodLoading = useAppStore((state) => state.foodLoading);
  const foodError = useAppStore((state) => state.foodError);
  const profile = useAppStore((state) => state.profile);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [gutScores, setGutScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [manualVisible, setManualVisible] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<FoodUnit>("serving");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [saveError, setSaveError] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [showExtraUnits, setShowExtraUnits] = useState(false);
  const [gutFeedbackTitle, setGutFeedbackTitle] = useState("");
  const [gutFeedback, setGutFeedback] = useState("");
  const [gutFeedbackLoading, setGutFeedbackLoading] = useState(false);
  const unitOptions = useMemo(
    () => getPreferredUnitOptions(profile?.preferredUnits),
    [profile?.preferredUnits]
  );

  useEffect(() => {
    setMealType(defaultMealType);
  }, [defaultMealType]);

  useEffect(() => {
    if (!unitOptions.includes(unit)) {
      setUnit("serving");
    }
  }, [unit, unitOptions]);
  const preview = useMemo(() => {
    if (!selectedFood) {
      return null;
    }

    const parsedQuantity = Number(quantity);
    if (!parsedQuantity || parsedQuantity <= 0) {
      return {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      };
    }

    const multiplier = getNutritionMultiplier(parsedQuantity, unit);
    return {
      calories: roundNutrition(selectedFood.caloriesPer100g * multiplier),
      proteinG: roundNutrition(selectedFood.proteinPer100g * multiplier),
      carbsG: roundNutrition(selectedFood.carbsPer100g * multiplier),
      fatG: roundNutrition(selectedFood.fatPer100g * multiplier),
    };
  }, [quantity, selectedFood, unit]);

  const runSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      setGutScores({});
      setError("");
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const nextResults = await searchFoodCatalog(query);
      setResults(nextResults);
      const initialScores: Record<string, number> = {};
      nextResults.forEach((item) => {
        const key = `${item.source}-${item.id}`;
        initialScores[key] = computeGutScore({
          fiberG: 0,
          proteinG: item.proteinPer100g,
          fatG: item.fatPer100g,
          carbsG: item.carbsPer100g,
          calories: item.caloriesPer100g,
          gutHealthTags: [],
          foodName: item.description,
        });
      });
      setGutScores(initialScores);
      nextResults.forEach((item) => {
        const key = `${item.source}-${item.id}`;
        fetchAiGutScore(
          item.description,
          0,
          item.proteinPer100g,
          item.fatPer100g,
          item.carbsPer100g,
          item.caloriesPer100g
        )
          .then((aiScore) => {
            setGutScores((prev) => ({ ...prev, [key]: aiScore }));
          })
          .catch(() => {});
      });
    } catch (searchError) {
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : "Unable to search foods right now.");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedFood(null);
    setManualVisible(false);
    setQuantity("1");
    setUnit("serving");
    setMealType("breakfast");
    setQuery("");
    setResults([]);
    setGutScores({});
    setError("");
    setHasSearched(false);
    setSaveError("");
    setManualName("");
    setManualCalories("");
    setManualProtein("");
    setManualCarbs("");
    setManualFat("");
    setShowExtraUnits(false);
    onRequestClose?.();
  };

  const openGutFeedback = async (
    foodName: string,
    score: number,
    macros: { fiberG: number; proteinG: number; fatG: number; carbsG: number; calories: number }
  ) => {
    setGutFeedbackTitle(formatFoodName(foodName));
    setGutFeedback("");
    setGutFeedbackLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `In 2 short warm sentences, explain why ${foodName} might land around ${score}/100 for gut comfort, steadier mood, and balanced energy. Known macros: ${Math.round(macros.calories)} cal, ${Math.round(macros.fiberG)}g fiber, ${Math.round(macros.proteinG)}g protein, ${Math.round(macros.fatG)}g fat, ${Math.round(macros.carbsG)}g carbs. Focus on how it might feel in the body and for mood, not on judging the food.`,
          mode: "gut_feedback",
          context: {},
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error();
      }
      const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
      setGutFeedback(
        !reply || /hit a snag|try again/i.test(reply)
          ? buildLocalGutFeedback(foodName, score, macros)
          : reply
      );
    } catch {
      setGutFeedback(buildLocalGutFeedback(foodName, score, macros));
    } finally {
      setGutFeedbackLoading(false);
    }
  };

  const confirmSave = async () => {
    if (!selectedFood) {
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!parsedQuantity || parsedQuantity <= 0) {
      setSaveError("Enter a quantity greater than zero.");
      return;
    }

    const result = await saveFoodLog({
      foodName: selectedFood.description,
      foodSource: selectedFood.source,
      externalFoodId: selectedFood.id,
      mealType,
      quantity: parsedQuantity,
      unit,
      calories: preview?.calories ?? 0,
      proteinG: preview?.proteinG ?? 0,
      carbsG: preview?.carbsG ?? 0,
      fatG: preview?.fatG ?? 0,
      fiberG: 0,
      sugarG: 0,
    });

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    closeModal();
  };

  const confirmManualSave = async () => {
    const parsedQuantity = Number(quantity);
    if (!manualName.trim()) {
      setSaveError("Enter a food name.");
      return;
    }
    if (!parsedQuantity || parsedQuantity <= 0) {
      setSaveError("Enter a quantity greater than zero.");
      return;
    }

    const result = await saveFoodLog({
      foodName: manualName.trim(),
      foodSource: "custom",
      mealType,
      quantity: parsedQuantity,
      unit,
      calories: Number(manualCalories) || 0,
      proteinG: Number(manualProtein) || 0,
      carbsG: Number(manualCarbs) || 0,
      fatG: Number(manualFat) || 0,
      fiberG: 0,
      sugarG: 0,
    });

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    closeModal();
  };

  const content = (
    <Card>
      <SectionTitle
        eyebrow="Add Food"
        title={title ?? "What did you eat?"}
        subtitle="Type any food and we'll look up the nutrition for you."
      />
      <Field
        label="Food name"
        value={query}
        onChangeText={setQuery}
        placeholder="Try salmon, oats, yogurt, kimchi..."
      />
      <PrimaryButton label={loading ? "Searching..." : "Search"} onPress={() => void runSearch()} />
      <PrimaryButton
        label="Add manually"
        secondary
        onPress={() => {
          setSaveError("");
          setManualName(query.trim());
          setManualVisible(true);
        }}
      />
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accentPrimary} />
          <Text style={styles.loadingText}>Looking up nutrition...</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {results.length ? (
        <View style={styles.searchResults}>
          {results.map((item) => {
            const key = `${item.source}-${item.id}`;
            const score = gutScores[key] ?? computeGutScore({ fiberG: 0, proteinG: item.proteinPer100g, fatG: item.fatPer100g, carbsG: item.carbsPer100g, calories: item.caloriesPer100g, gutHealthTags: [], foodName: item.description });
            return (
              <Pressable key={key} style={styles.searchResultCard} onPress={() => setSelectedFood(item)}>
                <Text style={styles.foodName}>{formatFoodName(item.description)}</Text>
                <GutScoreBadge
                  score={score}
                  onPress={() =>
                    void openGutFeedback(item.description, score, {
                      fiberG: item.fiberPer100g ?? 0,
                      proteinG: item.proteinPer100g,
                      fatG: item.fatPer100g,
                      carbsG: item.carbsPer100g,
                      calories: item.caloriesPer100g,
                    })
                  }
                />
                <Text style={styles.foodMeta}>
                  {Math.round(item.caloriesPer100g)} cal | {Math.round(item.proteinPer100g)}g protein | {Math.round(item.carbsPer100g)}g carbs | {Math.round(item.fatPer100g)}g fat
                </Text>
                <Text style={styles.tapHint}>Tap to add this food</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {hasSearched && !loading && !error && !results.length ? (
        <Text style={styles.emptyText}>
          We couldn't find nutrition for that just yet. Try a simpler food name.
        </Text>
      ) : null}
      <Modal transparent animationType="fade" visible={Boolean(gutFeedbackTitle)} onRequestClose={() => setGutFeedbackTitle("")}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <SectionTitle eyebrow="Gut score" title={gutFeedbackTitle} subtitle="A quick read on how this food may land for mood, energy, and digestion." />
            {gutFeedbackLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.accentPrimary} />
                <Text style={styles.loadingText}>Thinking through it...</Text>
              </View>
            ) : (
              <Text style={styles.emptyText}>{gutFeedback}</Text>
            )}
            <PrimaryButton label="Close" secondary onPress={() => setGutFeedbackTitle("")} />
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(selectedFood)} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <SectionTitle
              eyebrow="Add Food"
              title={formatFoodName(selectedFood?.description ?? "Selected food")}
              subtitle="Choose a meal and portion before saving this to today's log."
            />
            <Text style={styles.helper}>Meal</Text>
            <View style={styles.rowWrap}>
              {mealOptions.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  active={mealType === item}
                  onPress={() => setMealType(item)}
                />
              ))}
            </View>
            <Field
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="1"
            />
            <Text style={styles.helper}>Unit</Text>
            <View style={styles.unitControlRow}>
              <Pressable
                style={[styles.unitShortcutButton, unit === "serving" && styles.unitShortcutButtonActive]}
                onPress={() => {
                  setUnit("serving");
                  setShowExtraUnits(false);
                }}
              >
                <Text style={[styles.unitShortcutButtonText, unit === "serving" && styles.unitShortcutButtonTextActive]}>Serving</Text>
              </Pressable>
              {unit !== "serving" ? (
                <View style={[styles.unitShortcutButton, styles.unitShortcutButtonActive]}>
                  <Text style={[styles.unitShortcutButtonText, styles.unitShortcutButtonTextActive]}>{unit}</Text>
                </View>
              ) : null}
              <Pressable style={styles.unitMoreToggle} onPress={() => setShowExtraUnits((current) => !current)}>
                <Text style={styles.unitMoreToggleText}>{showExtraUnits ? "Hide other units" : "Other units"}</Text>
              </Pressable>
            </View>
            {showExtraUnits ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitOptionsScroll}>
                {unitOptions.filter((item) => item !== "serving").map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    active={unit === item}
                    onPress={() => setUnit(item)}
                  />
                ))}
              </ScrollView>
            ) : null}
            {preview ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Nutrition preview</Text>
                <Text style={styles.foodMeta}>
                  {Math.round(preview.calories)} cal | {Math.round(preview.proteinG)}g protein | {Math.round(preview.carbsG)}g carbs | {Math.round(preview.fatG)}g fat
                </Text>
              </View>
            ) : null}
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            {foodError && !saveError ? <Text style={styles.errorText}>{foodError}</Text> : null}
            <View style={styles.modalActions}>
              <PrimaryButton label="Cancel" secondary onPress={closeModal} />
              <PrimaryButton
                label={foodLoading ? "Saving..." : "Save food"}
                onPress={() => void confirmSave()}
              />
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={manualVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderSpacer} />
              <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>X</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <SectionTitle
                eyebrow="Manual Entry"
                title="Add food manually"
                subtitle="Type the food and macros yourself if you already know them."
              />
              <Field
                label="Food name"
                value={manualName}
                onChangeText={setManualName}
                placeholder="Protein bar, latte, sandwich..."
              />
              <Text style={styles.helper}>Meal</Text>
              <View style={styles.rowWrap}>
                {mealOptions.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    active={mealType === item}
                    onPress={() => setMealType(item)}
                  />
                ))}
              </View>
              <Field
                label="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
              />
              <Text style={styles.helper}>Unit</Text>
              <View style={styles.unitControlRow}>
                <Pressable
                  style={[styles.unitShortcutButton, unit === "serving" && styles.unitShortcutButtonActive]}
                  onPress={() => {
                    setUnit("serving");
                    setShowExtraUnits(false);
                  }}
                >
                  <Text style={[styles.unitShortcutButtonText, unit === "serving" && styles.unitShortcutButtonTextActive]}>Serving</Text>
                </Pressable>
                {unit !== "serving" ? (
                  <View style={[styles.unitShortcutButton, styles.unitShortcutButtonActive]}>
                    <Text style={[styles.unitShortcutButtonText, styles.unitShortcutButtonTextActive]}>{unit}</Text>
                  </View>
                ) : null}
                <Pressable style={styles.unitMoreToggle} onPress={() => setShowExtraUnits((current) => !current)}>
                  <Text style={styles.unitMoreToggleText}>{showExtraUnits ? "Hide other units" : "Other units"}</Text>
                </Pressable>
              </View>
              {showExtraUnits ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitOptionsScroll}>
                  {unitOptions.filter((item) => item !== "serving").map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      active={unit === item}
                      onPress={() => setUnit(item)}
                    />
                  ))}
                </ScrollView>
              ) : null}
              <View style={styles.manualMacroGrid}>
                <Field
                  label="Calories"
                  value={manualCalories}
                  onChangeText={setManualCalories}
                  placeholder="0"
                />
                <Field
                  label="Protein (g)"
                  value={manualProtein}
                  onChangeText={setManualProtein}
                  placeholder="0"
                />
                <Field
                  label="Carbs (g)"
                  value={manualCarbs}
                  onChangeText={setManualCarbs}
                  placeholder="0"
                />
                <Field
                  label="Fat (g)"
                  value={manualFat}
                  onChangeText={setManualFat}
                  placeholder="0"
                />
              </View>
              {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
              <View style={styles.modalActions}>
                <PrimaryButton label="Cancel" secondary onPress={closeModal} />
                <PrimaryButton
                  label={foodLoading ? "Saving..." : "Save food"}
                  onPress={() => void confirmManualSave()}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Card>
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onRequestClose}>
      <Pressable style={styles.modalBackdrop} onPress={onRequestClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {content}
          <PrimaryButton label="Close" secondary onPress={onRequestClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function FoodSearchLauncher({
  onPress,
}: {
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.searchLauncher} onPress={onPress}>
      <View style={styles.searchLauncherCopy}>
        <Text style={styles.searchLauncherEyebrow}>Add Food</Text>
        <Text style={styles.searchLauncherTitle}>What did you eat today?</Text>
        <Text style={styles.searchLauncherSubtitle}>
          Tap to search for a food, choose your meal, and add it to today&apos;s log.
        </Text>
      </View>
      <Text style={styles.searchLauncherAction}>Open search</Text>
    </Pressable>
  );
}
function SwipeableFoodRow({
  item,
  deleting,
  onEdit,
  onDelete,
}: {
  item: FoodLog;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [gutFeedbackVisible, setGutFeedbackVisible] = useState(false);
  const [gutFeedback, setGutFeedback] = useState("");
  const [gutFeedbackLoading, setGutFeedbackLoading] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsHeight = useRef(new Animated.Value(0)).current;
  const gutScore = computeGutScore({
    foodName: item.foodName,
    fiberG: item.fiberG,
    proteinG: item.proteinG,
    fatG: item.fatG,
    carbsG: item.carbsG,
    calories: item.calories,
    gutHealthTags: item.gutHealthTags,
  });

  const animateExpanded = (next: boolean) => {
    setExpanded(next);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: next ? 1.03 : 1,
        useNativeDriver: true,
        friction: 6,
        tension: 180,
      }),
      Animated.spring(translateY, {
        toValue: next ? -4 : 0,
        useNativeDriver: true,
        friction: 6,
        tension: 180,
      }),
      Animated.timing(actionsOpacity, {
        toValue: next ? 1 : 0,
        duration: next ? 180 : 120,
        useNativeDriver: false,
      }),
      Animated.timing(actionsHeight, {
        toValue: next ? 56 : 0,
        duration: next ? 180 : 120,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const openGutFeedback = async () => {
    setGutFeedbackVisible(true);
    setGutFeedback("");
    setGutFeedbackLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `In 2 short warm sentences, explain why ${item.foodName} might land around ${gutScore}/100 for gut comfort, steadier mood, and balanced energy. Known macros: ${Math.round(item.calories)} cal, ${Math.round(item.fiberG)}g fiber, ${Math.round(item.proteinG)}g protein, ${Math.round(item.fatG)}g fat, ${Math.round(item.carbsG)}g carbs. Focus on how it might feel in the body and for mood, not on judging the food.`,
          mode: "gut_feedback",
          context: {},
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error();
      }
      const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
      setGutFeedback(
        !reply || /hit a snag|try again/i.test(reply)
          ? buildLocalGutFeedback(item.foodName, gutScore, {
              fiberG: item.fiberG,
              proteinG: item.proteinG,
              fatG: item.fatG,
              carbsG: item.carbsG,
              calories: item.calories,
            })
          : reply
      );
    } catch {
      setGutFeedback(
        buildLocalGutFeedback(item.foodName, gutScore, {
          fiberG: item.fiberG,
          proteinG: item.proteinG,
          fatG: item.fatG,
          carbsG: item.carbsG,
          calories: item.calories,
        })
      );
    } finally {
      setGutFeedbackLoading(false);
    }
  };

  return (
    <View style={styles.longPressContainer}>
      <Animated.View
        style={[
          styles.longPressRowShell,
          expanded && styles.longPressRowShellActive,
          {
            transform: [{ scale }, { translateY }],
          },
        ]}
      >
        <Pressable
          style={styles.foodRowPressable}
          onLongPress={() => animateExpanded(true)}
          delayLongPress={180}
          onPress={() => {
            if (expanded) {
              animateExpanded(false);
            }
          }}
        >
          <View style={[styles.foodDot, { backgroundColor: pickFoodColor(item.gutHealthTags[0]) }]} />
          <View style={styles.foodCopy}>
            <View style={styles.foodTitleRow}>
              <Text style={styles.foodName}>{formatFoodName(item.foodName)}</Text>
              <GutScoreBadge score={gutScore} onPress={() => void openGutFeedback()} />
            </View>
            <Text style={styles.foodMeta}>
              {Math.round(item.quantity)} {item.unit} | {Math.round(item.calories)} cal | {Math.round(item.proteinG)}g protein
            </Text>
          </View>
        </Pressable>
      </Animated.View>
      <Modal transparent animationType="fade" visible={gutFeedbackVisible} onRequestClose={() => setGutFeedbackVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <SectionTitle eyebrow="Gut score" title={formatFoodName(item.foodName)} subtitle="A quick read on how this food may land for mood, energy, and digestion." />
            {gutFeedbackLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.accentPrimary} />
                <Text style={styles.loadingText}>Thinking through it...</Text>
              </View>
            ) : (
              <Text style={styles.emptyText}>{gutFeedback}</Text>
            )}
            <PrimaryButton label="Close" secondary onPress={() => setGutFeedbackVisible(false)} />
          </View>
        </View>
      </Modal>
      <Animated.View
        style={[
          styles.rowActionsWrap,
          {
            opacity: actionsOpacity,
            height: actionsHeight,
          },
        ]}
        pointerEvents={expanded ? "auto" : "none"}
      >
        <Pressable
          style={styles.editAction}
          onPress={() => {
            animateExpanded(false);
            onEdit();
          }}
        >
          <Text style={styles.editActionText}>Edit</Text>
        </Pressable>
        <Pressable
          style={styles.deleteAction}
          onPress={() => {
            animateExpanded(false);
            void onDelete();
          }}
        >
          <Text style={styles.deleteText}>{deleting ? "..." : "Delete"}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function QuickLogStrip() {
  const quickLogs = useAppStore((state) => state.quickLogs);
  const today = quickLogs[0];

  const items = [
    { emoji: "Cf", label: "Coffee", value: `${today?.caffeineMg ?? 0} mg` },
    { emoji: "St", label: "Steps", value: `${today?.steps ?? 0}` },
    { emoji: "Sl", label: "Sleep", value: `${today?.sleepHours ?? 0} hr` },
    { emoji: "Ex", label: "Exercise", value: `${today?.exerciseMinutes ?? 0} min` },
  ];

  return (
    <Card>
      <SectionTitle
        eyebrow="Quick Log"
        title="Small things count too"
        subtitle="Capture the factors that often shift mood and energy in the background."
      />
      <View style={styles.quickGrid}>
        {items.map((item) => (
          <View key={item.label} style={styles.quickTile}>
            <Text style={styles.quickEmoji}>{item.emoji}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
            <Text style={styles.quickValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function GraceModeCard() {
  return (
    <Card>
      <SectionTitle
        eyebrow="Grace Mode"
        title="Having a hard day?"
        subtitle="You can keep this simple. One tap is still showing up."
      />
      <PrimaryButton label="Open Grace Mode" secondary />
      <Text style={styles.graceText}>That's enough. You showed up today.</Text>
    </Card>
  );
}

function pickFoodColor(tag?: string) {
  switch (tag) {
    case "fermented":
    case "probiotic":
      return colors.accentSecondary;
    case "anti_inflammatory":
      return colors.accentTertiary;
    case "processed":
      return "#D6B28D";
    default:
      return colors.accentPrimary;
  }
}

function getNutritionMultiplier(quantity: number, unit: string) {
  const gramsPerUnit: Record<string, number> = {
    g: 1,
    oz: 28.3495,
    ml: 1,
    fl_oz: 29.5735,
    cup: 240,
    serving: 100,
    piece: 50,
  };

  return (quantity * (gramsPerUnit[unit] ?? 100)) / 100;
}

function roundNutrition(value: number) {
  return Math.round(value);
}

function MacroVisualCard({
  label,
  value,
  goal,
  unit,
  accent,
  tone,
  onPress,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  accent: string;
  tone: "warm" | "sage" | "amber" | "ink";
  onPress?: () => void;
}) {
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0;
  const fillWidth = `${Math.max(progress * 100, 8)}%`;
  const suffix = unit ? ` ${unit}` : "";
  const toneStyle =
    tone === "warm"
      ? styles.macroCardWarm
      : tone === "sage"
        ? styles.macroCardSage
        : tone === "amber"
          ? styles.macroCardAmber
          : styles.macroCardInk;

  return (
    <Pressable style={[styles.macroCard, toneStyle]} onPress={onPress}>
      <View style={styles.macroCardTop}>
        <Text style={styles.macroLabel}>{label}</Text>
        <View style={[styles.macroDot, { backgroundColor: accent }]} />
      </View>
      <Text style={styles.macroValue}>
        {value}
        {suffix}
      </Text>
      <Text style={styles.macroGoalText}>
        Goal {goal}
        {suffix}
      </Text>
      <View style={styles.macroRail}>
        <View style={[styles.macroFill, { width: fillWidth, backgroundColor: accent }]} />
      </View>
      <Text style={styles.macroTapHint}>Tap for more</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  stack: {
    gap: spacing.sm,
  },
  moodButton: {
    minWidth: 70,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  moodEmoji: {
    fontSize: 20,
  },
  moodLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dailyGutHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dailyGutEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  dailyGutTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  dailyGutBody: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  macroCard: {
    width: "48%",
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    gap: 8,
  },
  macroCardWarm: {
    backgroundColor: "#FBF0E9",
    borderColor: "rgba(196, 98, 45, 0.16)",
  },
  macroCardSage: {
    backgroundColor: "#EEF3EA",
    borderColor: "rgba(138, 158, 123, 0.2)",
  },
  macroCardAmber: {
    backgroundColor: "#FCF5E4",
    borderColor: "rgba(232, 168, 56, 0.2)",
  },
  macroCardInk: {
    backgroundColor: "#F3EEE8",
    borderColor: "rgba(44, 26, 14, 0.12)",
  },
  macroCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  macroLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  macroDot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
  },
  macroValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "700",
  },
  macroGoalText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  macroRail: {
    height: 10,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.82)",
    overflow: "hidden",
  },
  macroFill: {
    height: "100%",
    borderRadius: radii.round,
  },
  macroTapHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "600",
  },
  mealTotal: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  mealTotalsWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  mealMacroSummary: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 2,
    marginBottom: 6,
  },
  linkText: {
    color: colors.accentPrimary,
    fontWeight: "600",
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
  },
  foodDot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
  },
  foodCopy: {
    flex: 1,
    gap: 4,
  },
  foodTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  foodName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  gutScoreWrap: {
    alignSelf: "flex-start",
    gap: 4,
  },
  gutScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  gutScoreText: {
    fontSize: 12,
    fontWeight: "700",
  },
  gutSpectrumWrap: {
    width: 72,
    position: "relative",
    paddingTop: 2,
  },
  gutSpectrumDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
    position: "absolute",
    top: -2,
  },
  gutSpectrumBar: {
    flexDirection: "row",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  gutSpectrumSegment: {
    flex: 1,
  },
  foodMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickTile: {
    width: "48%",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  quickEmoji: {
    fontSize: 18,
  },
  quickLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickValue: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  graceText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 26,
  },
  savedMoodWrap: {
    gap: spacing.sm,
  },
  savedMoodBadge: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
  },
  savedMoodScore: {
    fontSize: 18,
    fontWeight: "700",
  },
  savedMoodText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  errorText: {
    color: colors.accentPrimary,
    fontSize: 14,
  },
  searchResults: {
    gap: spacing.sm,
  },
  searchResultCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
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
  unitControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  unitShortcutButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  unitShortcutButtonActive: {
    backgroundColor: "#F6DFC9",
    borderColor: colors.accentPrimary,
  },
  unitShortcutButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  unitShortcutButtonTextActive: {
    color: colors.accentPrimary,
  },
  unitMoreToggle: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  unitMoreToggleText: {
    color: colors.accentPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  unitOptionsScroll: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  tapHint: {
    color: colors.accentPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  addMealButton: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: "#F6DFC9",
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addMealText: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  searchLauncher: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  searchLauncherCopy: {
    gap: 4,
  },
  searchLauncherEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  searchLauncherTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "600",
  },
  searchLauncherSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  searchLauncherAction: {
    color: colors.accentPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(44, 26, 14, 0.28)",
    justifyContent: "center",
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "85%",
  },
  modalActions: {
    gap: spacing.sm,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalHeaderSpacer: {
    flex: 1,
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  modalScroll: {
    maxHeight: "100%",
  },
  modalScrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  manualMacroGrid: {
    gap: spacing.sm,
  },
  previewCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
  },
  previewTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  longPressContainer: {
    gap: spacing.xs,
    paddingTop: 2,
    paddingBottom: 4,
  },
  longPressRowShell: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  longPressRowShellActive: {
    backgroundColor: "#FBF6EF",
    borderColor: "rgba(196, 98, 45, 0.14)",
    shadowColor: "#2C1A0E",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  foodRowPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  rowActionsWrap: {
    flexDirection: "row",
    gap: spacing.sm,
    overflow: "hidden",
  },
  editAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTertiary,
    borderRadius: radii.md,
    minHeight: 48,
  },
  editActionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  deleteAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#A93D4A",
    borderRadius: radii.md,
    minHeight: 48,
  },
  deleteText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  hydrationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  hydrationEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hydrationTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4,
  },
  hydrationTotal: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: "700",
  },
  hydrationRail: {
    height: 14,
    borderRadius: radii.round,
    backgroundColor: "#E8F1F8",
    overflow: "hidden",
  },
  hydrationFill: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.blue,
  },
  hydrationBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  macroModalHeading: {
    flex: 1,
    gap: 4,
  },
  macroModalEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  macroModalTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "700",
  },
  macroModalScroll: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  macroModalBody: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 26,
  },
  macroModalCallout: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  macroDetailStat: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  macroDetailStatLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  macroDetailStatValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  breakdownSection: {
    gap: spacing.sm,
  },
  breakdownTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  breakdownRow: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  breakdownCopy: {
    gap: 6,
  },
  breakdownTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownFood: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  breakdownAmount: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  breakdownMeal: {
    color: colors.textSecondary,
    fontSize: 13,
    textTransform: "capitalize",
  },
  breakdownRail: {
    height: 10,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: radii.round,
  },
  breakdownShare: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  learnMoreSection: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  learnMoreTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  learnMoreGrid: {
    gap: spacing.sm,
  },
  learnMoreCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  learnMoreSwatch: {
    width: 44,
    height: 10,
    borderRadius: radii.round,
  },
  learnMoreFood: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  learnMoreNote: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
});

