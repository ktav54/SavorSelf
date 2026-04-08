import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Chip, Field, MetricPill, PrimaryButton, SectionTitle } from "@/components/ui";
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
const unitOptions: FoodUnit[] = ["g", "oz", "ml", "fl_oz", "cup", "serving", "piece"];

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
  const quickLogs = useAppStore((state) => state.quickLogs);

  const totals = useMemo(() => {
    const calories = foodLogs.reduce((sum, item) => sum + item.calories, 0);
    const protein = foodLogs.reduce((sum, item) => sum + item.proteinG, 0);
    const water = quickLogs.reduce((sum, item) => sum + (item.waterOz ?? 0), 0);

    return {
      calories: Math.round(calories),
      protein: Math.round(protein),
      water: Math.round(water),
    };
  }, [foodLogs, quickLogs]);

  return (
    <View style={styles.metricsRow}>
      <MetricPill
        label="Calories"
        value={`${totals.calories} / ${profile?.dailyCalorieGoal ?? 0}`}
        accent={colors.accentPrimary}
      />
      <MetricPill
        label="Protein"
        value={`${totals.protein}g / ${profile?.dailyProteinGoal ?? 0}g`}
        accent={colors.accentSecondary}
      />
      <MetricPill
        label="Water"
        value={`${totals.water} oz / ${profile?.dailyWaterGoal ?? 0} oz`}
        accent={colors.blue}
      />
    </View>
  );
}

export function FoodLogSection({ mealType, logs }: { mealType: FoodLog["mealType"]; logs: FoodLog[] }) {
  const deleteFoodLog = useAppStore((state) => state.deleteFoodLog);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mealCalories = logs.reduce((sum, item) => sum + item.calories, 0);

  return (
    <Card>
      <View style={styles.sectionRow}>
        <Text style={styles.mealTitle}>{mealType[0].toUpperCase() + mealType.slice(1)}</Text>
        <Text style={styles.mealTotal}>{Math.round(mealCalories)} cal</Text>
      </View>
      <View style={styles.sectionDivider} />
      {logs.length ? (
        logs.map((item, index) => (
          <View key={item.id} style={index < logs.length - 1 ? styles.rowDivider : undefined}>
            <SwipeableFoodRow
              item={item}
              deleting={deletingId === item.id}
              onDelete={async () => {
                setDeletingId(item.id);
                await deleteFoodLog(item.id);
                setDeletingId(null);
              }}
            />
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Nothing logged here yet. Add what felt meaningful, not everything at once.</Text>
      )}
      <Pressable style={styles.addMealButton}>
        <Text style={styles.addMealText}>Add to {mealType}</Text>
      </Pressable>
    </Card>
  );
}

export function FoodSearchCard() {
  const saveFoodLog = useAppStore((state) => state.saveFoodLog);
  const foodLoading = useAppStore((state) => state.foodLoading);
  const foodError = useAppStore((state) => state.foodError);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<FoodUnit>("serving");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [saveError, setSaveError] = useState("");
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
    } catch (searchError) {
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : "Unable to search foods right now.");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedFood(null);
    setQuantity("1");
    setUnit("serving");
    setMealType("breakfast");
    setSaveError("");
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

  return (
    <Card>
      <SectionTitle
        eyebrow="Food Search"
        title="Search food databases"
        subtitle="Search USDA and Open Food Facts together, with whole foods favored from USDA and packaged foods from Open Food Facts."
      />
      <Field
        label="Search foods"
        value={query}
        onChangeText={setQuery}
        placeholder="Try salmon, oats, yogurt, kimchi..."
      />
      <PrimaryButton label={loading ? "Searching..." : "Search"} onPress={() => void runSearch()} />
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accentPrimary} />
          <Text style={styles.loadingText}>Searching USDA and Open Food Facts...</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {results.length ? (
        <View style={styles.searchResults}>
          {results.map((item) => (
            <Pressable
              key={`${item.source}-${item.id}`}
              style={styles.searchResultCard}
              onPress={() => setSelectedFood(item)}
            >
              <Text style={styles.foodName}>{formatFoodName(item.description)}</Text>
              {item.subtitle ? <Text style={styles.searchSource}>{item.subtitle}</Text> : null}
              <Text style={styles.foodMeta}>
                {Math.round(item.caloriesPer100g)} cal | {Math.round(item.proteinPer100g)}g protein | {Math.round(item.carbsPer100g)}g carbs | {Math.round(item.fatPer100g)}g fat
              </Text>
              <Text style={styles.tapHint}>Tap to add this food</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {hasSearched && !loading && !error && results.length === 0 ? (
        <Text style={styles.emptyText}>
          No foods matched that search. Try a broader term like "salmon" or "oatmeal".
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
            <View style={styles.rowWrap}>
              {unitOptions.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  active={unit === item}
                  onPress={() => setUnit(item)}
                />
              ))}
            </View>
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
    </Card>
  );
}

function SwipeableFoodRow({
  item,
  deleting,
  onDelete,
}: {
  item: FoodLog;
  deleting: boolean;
  onDelete: () => Promise<void>;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opened = useRef(false);

  const snapTo = (value: number) => {
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
    opened.current = value !== 0;
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 12,
      onPanResponderMove: (_, gestureState) => {
        const next = Math.max(-88, Math.min(0, gestureState.dx + (opened.current ? -88 : 0)));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40 || (opened.current && gestureState.dx < 20)) {
          snapTo(-88);
        } else {
          snapTo(0);
        }
      },
      onPanResponderTerminate: () => {
        snapTo(opened.current ? -88 : 0);
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <Pressable style={styles.deleteAction} onPress={() => void onDelete()}>
        <Text style={styles.deleteText}>{deleting ? "..." : "Delete"}</Text>
      </Pressable>
      <Animated.View
        style={[
          styles.foodRow,
          styles.swipeableRow,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.foodDot, { backgroundColor: pickFoodColor(item.gutHealthTags[0]) }]} />
        <View style={styles.foodCopy}>
          <Text style={styles.foodName}>{formatFoodName(item.foodName)}</Text>
          <Text style={styles.foodMeta}>
            {Math.round(item.quantity)} {item.unit} | {Math.round(item.calories)} cal | {Math.round(item.proteinG)}g protein
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export function QuickLogStrip() {
  const quickLogs = useAppStore((state) => state.quickLogs);
  const today = quickLogs[0];

  const items = [
    { emoji: "Cf", label: "Coffee", value: `${today?.caffeineMg ?? 0} mg` },
    { emoji: "H2O", label: "Water", value: `${today?.waterOz ?? 0} oz` },
    { emoji: "St", label: "Steps", value: `${today?.steps ?? 0}` },
    { emoji: "Sl", label: "Sleep", value: `${today?.sleepHours ?? 0} hr` },
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
  metricsRow: {
    gap: spacing.sm,
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
    color: colors.textSecondary,
    fontSize: 14,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(44, 26, 14, 0.28)",
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
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
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.md,
  },
  swipeableRow: {
    paddingHorizontal: 4,
  },
  deleteAction: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTertiary,
    borderRadius: radii.md,
  },
  deleteText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
});
