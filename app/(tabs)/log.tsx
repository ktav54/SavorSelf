import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, format, isToday, isYesterday } from "date-fns";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "@/components/ui";
import {
  FoodLogSection,
  FoodSearchCard,
  FoodSearchLauncher,
  HydrationSummaryCard,
  MacroSummaryBar,
  MoodCheckInStrip,
  QuickLogStrip,
} from "@/components/log";
import { colors, radii, spacing } from "@/constants/theme";
import { useAppStore, type AppState } from "@/store/useAppStore";
import type { FoodLog, MealType } from "@/types/models";

type EntryStep = "hidden" | "welcome";

const dailySubtitles = [
  "Small choices compound. Today is a good day to notice one.",
  "Check in, add what you ate, and let the patterns build.",
  "Your gut-brain story gets richer every time you log.",
  "One honest check-in is worth more than perfection.",
  "What you eat today shapes how you feel tomorrow.",
] as const;

const moodSummaryOptions = [
  { score: 1, emoji: "😔", label: "Low" },
  { score: 2, emoji: "😕", label: "Okay" },
  { score: 3, emoji: "😐", label: "Neutral" },
  { score: 4, emoji: "🙂", label: "Good" },
  { score: 5, emoji: "😄", label: "Great" },
] as const;

const energySummaryOptions = ["Drained", "Low", "Okay", "Good", "Wired"] as const;
const mealCardOrder: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export default function LogScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const profile = useAppStore((state: AppState) => state.profile);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const insights = useAppStore((state: AppState) => state.insights);
  const foodMoodSnapshot = useAppStore((state: AppState) => state.foodMoodSnapshot);
  const foodMoodTrend = useAppStore((state: AppState) => state.foodMoodTrend);
  const selectedDate = useAppStore((state: AppState) => state.selectedDate);
  const setSelectedDate = useAppStore((state: AppState) => state.setSelectedDate);
  const loadTodayMoodLog = useAppStore((state: AppState) => state.loadTodayMoodLog);
  const loadTodayFoodLogs = useAppStore((state: AppState) => state.loadTodayFoodLogs);
  const loadTodayQuickLog = useAppStore((state: AppState) => state.loadTodayQuickLog);
  const loadFoodMoodInsights = useAppStore((state: AppState) => state.loadFoodMoodInsights);
  const [defaultMealType, setDefaultMealType] = useState<MealType>("breakfast");
  const [mealContext, setMealContext] = useState<MealType | null>(null);
  const [foodSearchVisible, setFoodSearchVisible] = useState(false);
  const [entryStep, setEntryStep] = useState<EntryStep>("hidden");
  const [refreshing, setRefreshing] = useState(false);
  const hasShownEntryThisSession = useRef(false);
  const lastLoaded = useRef<string | null>(null);
  const touchStartX = useRef(0);
  const heroRise = useRef(new Animated.Value(24)).current;
  const heroFade = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const pillPulse = useRef(new Animated.Value(0)).current;
  const mealAnims = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(0))
  ).current;

  useFocusEffect(
    useCallback(() => {
      const currentDate = useAppStore.getState().selectedDate;
      const cacheKey = `${format(currentDate, "yyyy-MM-dd")}-${profile?.id ?? "guest"}`;

      if (lastLoaded.current === cacheKey) {
        return;
      }

      lastLoaded.current = cacheKey;
      void loadTodayMoodLog(currentDate);
      void loadTodayFoodLogs(currentDate);
      void loadTodayQuickLog(currentDate);

      if (!hasShownEntryThisSession.current && isToday(currentDate)) {
        hasShownEntryThisSession.current = true;
        setEntryStep("welcome");
      }
    }, [loadTodayFoodLogs, loadTodayMoodLog, loadTodayQuickLog, profile?.id])
  );

  const isSelectedDateToday = isToday(selectedDate);
  const totalCalories = useMemo(
    () => foodLogs.reduce((sum, item) => sum + item.calories, 0),
    [foodLogs]
  );
  const calorieGoal = profile?.dailyCalorieGoal ?? 0;
  const calorieProgress = calorieGoal > 0 ? totalCalories / calorieGoal : 0;

  useEffect(() => {
    if (!isSelectedDateToday) {
      setEntryStep("hidden");
    }
  }, [isSelectedDateToday]);

  useEffect(() => {
    if (entryStep === "hidden") {
      heroFade.setValue(0);
      heroRise.setValue(24);
      return;
    }

    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(heroRise, {
        toValue: 0,
        useNativeDriver: true,
        damping: 16,
        stiffness: 120,
        mass: 0.8,
      }),
    ]).start();
  }, [entryStep, heroFade, heroRise]);

  useEffect(() => {
    const logoLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoFloat, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(logoGlow, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(pillPulse, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(logoFloat, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(logoGlow, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(pillPulse, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: false,
          }),
        ]),
      ])
    );

    logoLoop.start();

    return () => {
      logoLoop.stop();
    };
  }, [logoFloat, logoGlow, pillPulse]);

  useEffect(() => {
    mealAnims.forEach((anim) => anim.setValue(0));
    Animated.stagger(
      80,
      mealAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [mealAnims]);

  const openFoodSearch = (mealType: MealType) => {
    setMealContext(mealType);
    setDefaultMealType(mealType);
    setFoodSearchVisible(true);
  };

  const openGeneralFoodSearch = () => {
    setMealContext(null);
    setFoodSearchVisible(true);
  };

  const closeFoodSearch = () => {
    setFoodSearchVisible(false);
    setMealContext(null);
  };

  const todaysMood = moodLogs[0] ?? null;
  const todaySubtitle = dailySubtitles[new Date().getDay() % dailySubtitles.length];
  const logHeaderDate = isSelectedDateToday
    ? `Today, ${format(new Date(), "MMMM d")}`
    : isYesterday(selectedDate)
      ? `Yesterday, ${format(selectedDate, "MMMM d")}`
      : format(selectedDate, "EEE, MMMM d");
  const pastDayMoodOption = moodSummaryOptions.find((option) => option.score === todaysMood?.moodScore);
  const pastDayEnergyLabel = todaysMood ? energySummaryOptions[(todaysMood.energyScore ?? 3) - 1] : "";
  const hasAnyFoodMoodHistory =
    insights.length > 0 || foodMoodTrend.length > 0 || foodMoodSnapshot !== null;
  const isFirstTimeEmpty = isSelectedDateToday && foodLogs.length === 0 && !hasAnyFoodMoodHistory;
  const generalFoodTitle = mealContext
    ? `What did you eat for ${mealContext}?`
    : isSelectedDateToday
      ? "What did you eat today?"
      : `What did you eat on ${format(selectedDate, "MMM d")}?`;

  const floatingLogoStyle = {
    transform: [
      {
        translateY: logoFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        }),
      },
      {
        scale: logoGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.035],
        }),
      },
    ],
  };

  const glowStyle = {
    opacity: logoGlow.interpolate({
      inputRange: [0, 1],
      outputRange: [0.25, 0.62],
    }),
    transform: [
      {
        scale: logoGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.12],
        }),
      },
    ],
  };

  const leftPillWidth = pillPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [46, 66],
  });
  const centerPillWidth = pillPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [46, 88],
  });
  const rightPillWidth = pillPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [46, 60],
  });

  const goToPreviousDay = useCallback(() => {
    void setSelectedDate(addDays(selectedDate, -1));
  }, [selectedDate, setSelectedDate]);

  const goToNextDay = useCallback(() => {
    if (!isSelectedDateToday) {
      void setSelectedDate(addDays(selectedDate, 1));
    }
  }, [isSelectedDateToday, selectedDate, setSelectedDate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    lastLoaded.current = null;
    const currentDate = useAppStore.getState().selectedDate;

    try {
      await Promise.all([
        loadTodayMoodLog(currentDate),
        loadTodayFoodLogs(currentDate),
        loadTodayQuickLog(),
        loadFoodMoodInsights(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadFoodMoodInsights, loadTodayFoodLogs, loadTodayMoodLog, loadTodayQuickLog]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Log",
      headerTitleStyle: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.textPrimary,
      },
      headerLeft: () => (
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginLeft: 14,
            paddingHorizontal: 2,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
        </Pressable>
      ),
    });
  }, [navigation, router]);

  return (
    <>
      <Screen>
        <ScrollView
          contentContainerStyle={styles.screenScrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={colors.accentPrimary}
              colors={[colors.accentPrimary]}
            />
          }
        >
          <View
            style={styles.screenStack}
            onTouchStart={(event) => {
              touchStartX.current = event.nativeEvent.pageX;
            }}
            onTouchEnd={(event) => {
              const diff = touchStartX.current - event.nativeEvent.pageX;
              if (diff > 60) {
                goToNextDay();
              } else if (diff < -60) {
                goToPreviousDay();
              }
            }}
          >
            <View style={styles.logHeader}>
            <View style={styles.logHeaderDateRow}>
              <Pressable style={({ pressed }) => [styles.dateNavButton, pressed && styles.dateNavPressed]} onPress={goToPreviousDay} accessibilityLabel="Previous day" accessibilityRole="button">
                <Text style={styles.dateNavText}>{"‹"}</Text>
              </Pressable>
              <Text style={styles.logHeaderDate}>{logHeaderDate}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.dateNavButton,
                  isSelectedDateToday && styles.dateNavButtonDisabled,
                  pressed && !isSelectedDateToday && styles.dateNavPressed,
                ]}
                onPress={goToNextDay}
                disabled={isSelectedDateToday}
                accessibilityLabel="Next day"
                accessibilityRole="button"
              >
                <Text style={[styles.dateNavText, isSelectedDateToday && styles.dateNavTextDisabled]}>{"›"}</Text>
              </Pressable>
            </View>
            <Text style={styles.logHeaderTitle}>{`Hi${profile?.name ? `, ${profile.name}` : ""}`}</Text>
            <Text style={styles.logHeaderSubtitle}>
              {isSelectedDateToday
                ? todaySubtitle
                : `Looking back at ${format(selectedDate, "MMMM d")}.`}
            </Text>
          </View>

          {isSelectedDateToday ? <MoodCheckInStrip /> : null}

          {!isSelectedDateToday && todaysMood && pastDayMoodOption ? (
            <View style={styles.pastMoodSummaryCard}>
              <View style={styles.pastMoodSummaryLeft}>
                <View style={styles.pastMoodEmojiWrap}>
                  <Text style={styles.pastMoodEmoji}>{pastDayMoodOption.emoji}</Text>
                </View>
                <Text style={styles.pastMoodSummaryText}>
                  {`Feeling ${pastDayMoodOption.label} · ${pastDayEnergyLabel}`}
                </Text>
              </View>
              <Text style={styles.pastMoodSummaryDate}>{format(selectedDate, "EEE, MMM d")}</Text>
            </View>
          ) : null}

            {isSelectedDateToday ? <MacroSummaryBar /> : null}
            {isSelectedDateToday && calorieGoal > 0 ? (
              <View>
                <View style={styles.goalProgressBar}>
                  <View
                    style={[
                      styles.goalProgressFill,
                      {
                        width: `${Math.min(100, calorieProgress * 100)}%`,
                        backgroundColor: calorieProgress >= 1 ? "#5C9E6E" : colors.accentPrimary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.goalProgressLabel}>
                  {Math.round(calorieProgress * 100)}% of daily goal
                </Text>
              </View>
            ) : null}
            {isSelectedDateToday ? <FoodSearchLauncher onPress={openGeneralFoodSearch} /> : null}
            {isFirstTimeEmpty ? (
              <View style={styles.firstTimeEmpty}>
                <Text style={styles.firstTimeEmoji}>🌱</Text>
                <Text style={styles.firstTimeTitle}>Your log is ready</Text>
                <Text style={styles.firstTimeSub}>
                  Add your first meal to start building your gut-brain picture. The coach can log food just from a description.
                </Text>
                <Pressable style={styles.firstTimeCTA} onPress={() => router.push("/(tabs)/coach")}>
                  <Text style={styles.firstTimeCTAText}>Try the coach →</Text>
                </Pressable>
              </View>
            ) : null}
            <FoodSearchCard
              visible={foodSearchVisible}
              onRequestClose={closeFoodSearch}
              defaultMealType={defaultMealType}
              title={generalFoodTitle}
            />
            {mealCardOrder.map((meal, index) => (
              <Animated.View
                key={meal}
                style={{
                  opacity: mealAnims[index],
                  transform: [
                    {
                      translateY: mealAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                }}
              >
                <FoodLogSection
                  mealType={meal}
                  logs={foodLogs.filter((item: FoodLog) => item.mealType === meal)}
                  onAddFood={() => openFoodSearch(meal)}
                />
              </Animated.View>
            ))}
            {!isSelectedDateToday ? <FoodSearchLauncher onPress={openGeneralFoodSearch} /> : null}
            <HydrationSummaryCard />
            <QuickLogStrip />
          </View>
        </ScrollView>
      </Screen>

      <Modal visible={entryStep === "welcome"} animationType="fade" transparent>
        <View style={styles.entryScreen}>
          <Animated.View
            style={[
              styles.heroCard,
              {
                opacity: heroFade,
                transform: [{ translateY: heroRise }],
              },
            ]}
          >
            <View style={styles.entryTopBar}>
              <View />
              <Pressable onPress={() => setEntryStep("hidden")} style={styles.entryCloseButton}>
                <Text style={styles.entryCloseText}>X</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.entryScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View style={[styles.heroGlow, glowStyle]} />
              <View style={styles.heroMarkWrap}>
                <Animated.View style={[styles.heroLogoFrame, floatingLogoStyle]}>
                  <Image source={require("../../logo.png")} style={styles.heroLogo} resizeMode="contain" />
                </Animated.View>
              </View>
              <Text style={styles.heroWelcomeBack}>Welcome back</Text>
              <Text style={styles.heroSubtitle}>Mood-first Food & Wellness Journal</Text>
              <Text style={styles.heroBody}>
                Hello{profile?.name ? `, ${profile.name}` : ""}. Start with a quick check-in, then let the rest of your log stay gentle.
              </Text>
              <View style={styles.heroPillRow}>
                <Animated.View style={[styles.heroPill, { backgroundColor: "#F7DCC8", width: leftPillWidth }]} />
                <Animated.View style={[styles.heroPill, { backgroundColor: "#D9E3D2", width: centerPillWidth }]} />
                <Animated.View style={[styles.heroPill, { backgroundColor: "#F3E1A9", width: rightPillWidth }]} />
              </View>
              <Pressable style={styles.heroPrimary} onPress={() => setEntryStep("hidden")}>
                <Text style={styles.heroPrimaryText}>{todaysMood ? "Open today's log" : "Begin today's check-in"}</Text>
              </Pressable>
              <Pressable style={styles.heroSecondary} onPress={() => setEntryStep("hidden")}>
                <Text style={styles.heroSecondaryText}>Skip for now</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screenScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: spacing.xl,
  },
  screenStack: {
    gap: 20,
    width: "100%",
  },
  logHeader: {
    gap: 8,
    paddingTop: 2,
    paddingBottom: 4,
  },
  logHeaderDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logHeaderDate: {
    color: colors.textSecondary,
    fontSize: 14,
    letterSpacing: 1,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  dateNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3EDE7",
  },
  dateNavButtonDisabled: {
    backgroundColor: "#F5F1EC",
    opacity: 0.3,
  },
  dateNavPressed: {
    opacity: 0.7,
  },
  dateNavText: {
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "300",
  },
  dateNavTextDisabled: {
    color: colors.textSecondary,
  },
  logHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  logHeaderSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  pastMoodSummaryCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pastMoodSummaryLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pastMoodEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F6EDE4",
    alignItems: "center",
    justifyContent: "center",
  },
  pastMoodEmoji: {
    fontSize: 18,
  },
  pastMoodSummaryText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  pastMoodSummaryDate: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  goalProgressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 8,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  goalProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  goalProgressLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "right",
    marginTop: 4,
    marginRight: 16,
  },
  firstTimeEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  firstTimeEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  firstTimeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  firstTimeSub: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 20,
  },
  firstTimeCTA: {
    backgroundColor: "#F6EDE4",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  firstTimeCTAText: {
    fontSize: 15,
    color: colors.accentPrimary,
    fontWeight: "600",
  },
  entryScreen: {
    flex: 1,
    backgroundColor: "rgba(196, 98, 45, 0.96)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  entryTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  entryCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  entryCloseText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  entryScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  heroCard: {
    backgroundColor: "rgba(250, 247, 242, 0.08)",
    borderRadius: 28,
    padding: spacing.lg,
    overflow: "hidden",
    minHeight: "88%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  heroGlow: {
    position: "absolute",
    top: -30,
    right: -10,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  heroMarkWrap: {
    alignItems: "center",
  },
  heroLogoFrame: {
    backgroundColor: "rgba(250, 247, 242, 0.96)",
    width: 500,
    height: 250,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: "rgba(44,26,14,0.08)",
    alignSelf: "center",
    overflow: "hidden",
  },
  heroLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
  },
  heroWelcomeBack: {
    color: "#F7DCC8",
    fontSize: 14,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 18,
    textAlign: "center",
    fontWeight: "600",
  },
  heroBody: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    lineHeight: 27,
    textAlign: "center",
  },
  heroPillRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  heroPill: {
    width: 46,
    height: 8,
    borderRadius: radii.round,
  },
  heroPrimary: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  heroPrimaryText: {
    color: colors.accentPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  heroSecondary: {
    alignItems: "center",
    paddingVertical: 10,
  },
  heroSecondaryText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    fontWeight: "600",
  },
});
