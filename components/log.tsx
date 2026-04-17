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

  return (
    <>
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
  const [result, setResult] = useState<FoodSearchResult | null>(null);
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
      setResult(null);
      setError("");
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const nextResults = await searchFoodCatalog(query);
      setResult(nextResults[0] ?? null);
    } catch (searchError) {
      setResult(null);
      setError(searchError instanceof Error ? searchError.message : "Unable to look up nutrition right now.");
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
    setResult(null);
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
      {result ? (
        <View style={styles.searchResults}>
          <Pressable
            style={styles.searchResultCard}
            onPress={() => setSelectedFood(result)}
          >
            <Text style={styles.foodName}>{formatFoodName(result.description)}</Text>
            <Text style={styles.foodMeta}>
              {Math.round(result.caloriesPer100g)} cal | {Math.round(result.proteinPer100g)}g protein | {Math.round(result.carbsPer100g)}g carbs | {Math.round(result.fatPer100g)}g fat
            </Text>
            <Text style={styles.tapHint}>Tap to add this food</Text>
          </Pressable>
        </View>
      ) : null}
      {hasSearched && !loading && !error && !result ? (
        <Text style={styles.emptyText}>
          We couldn't find nutrition for that just yet. Try a simpler food name.
        </Text>
      ) : null}
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
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsHeight = useRef(new Animated.Value(0)).current;

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
            <Text style={styles.foodName}>{formatFoodName(item.foodName)}</Text>
            <Text style={styles.foodMeta}>
              {Math.round(item.quantity)} {item.unit} | {Math.round(item.calories)} cal | {Math.round(item.proteinG)}g protein
            </Text>
          </View>
        </Pressable>
      </Animated.View>
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
  foodName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
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
  searchSource: {
    color: colors.textSecondary,
    fontSize: 12,
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

