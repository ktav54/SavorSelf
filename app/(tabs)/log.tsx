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
  Platform,
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
import { formatFoodName } from "@/lib/utils";
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
const editorialSerif = Platform.select({ ios: "Georgia", android: "serif" });
const mealAccentColors: Record<MealType, string> = {
  breakfast: "#6A8CFF",
  lunch: "#6C4E37",
  dinner: "#D89C45",
  snack: "#8A9E7B",
};

export default function LogScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const profile = useAppStore((state: AppState) => state.profile);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const analyticsFoodLogs = useAppStore((state: AppState) => state.analyticsFoodLogs);
  const quickLogs = useAppStore((state: AppState) => state.quickLogs);
  const selectedDate = useAppStore((state: AppState) => state.selectedDate);
  const setSelectedDate = useAppStore((state: AppState) => state.setSelectedDate);
  const loadTodayMoodLog = useAppStore((state: AppState) => state.loadTodayMoodLog);
  const loadTodayFoodLogs = useAppStore((state: AppState) => state.loadTodayFoodLogs);
  const loadTodayQuickLog = useAppStore((state: AppState) => state.loadTodayQuickLog);
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
  const totalProtein = useMemo(
    () => foodLogs.reduce((sum, item) => sum + item.proteinG, 0),
    [foodLogs]
  );
  const totalFiber = useMemo(
    () => foodLogs.reduce((sum, item) => sum + item.fiberG, 0),
    [foodLogs]
  );

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
  const hasEverLoggedFood = foodLogs.length > 0 || analyticsFoodLogs.length > 0;
  const isFirstTimeEmpty = isSelectedDateToday && !hasEverLoggedFood;
  const todayQuickLog = quickLogs[0] ?? null;
  const loggedMealCount = useMemo(
    () => mealCardOrder.filter((meal) => foodLogs.some((item: FoodLog) => item.mealType === meal)).length,
    [foodLogs]
  );
  const generalFoodTitle = mealContext
    ? `What did you eat for ${mealContext}?`
    : isSelectedDateToday
      ? "What did you eat today?"
      : `What did you eat on ${format(selectedDate, "MMM d")}?`;
  const moodArcSummary = todaysMood
    ? `${pastDayMoodOption?.label ?? "Steady"} mood, ${pastDayEnergyLabel.toLowerCase()} energy`
    : "Check in once and your daily arc starts to take shape.";
  const todayFlow = useMemo(
    () =>
      mealCardOrder.map((meal) => {
        const entries = foodLogs
          .filter((item: FoodLog) => item.mealType === meal)
          .sort((left, right) => new Date(left.loggedAt).getTime() - new Date(right.loggedAt).getTime());
        const firstEntry = entries[0] ?? null;
        const totalMealCalories = entries.reduce((sum, item) => sum + item.calories, 0);

        return {
          meal,
          primary:
            entries.length === 0
              ? "Not yet logged"
              : entries.length === 1
                ? formatFoodName(firstEntry?.foodName ?? "")
                : `${formatFoodName(firstEntry?.foodName ?? "")} + ${entries.length - 1} more`,
          secondary:
            entries.length === 0
              ? "Add something when you're ready"
              : `${entries.length} item${entries.length > 1 ? "s" : ""} logged`,
          time: firstEntry ? format(new Date(firstEntry.loggedAt), "h:mm") : "-",
          calories: Math.round(totalMealCalories),
        };
      }),
    [foodLogs]
  );
  const glanceStats = [
    { label: "Fiber", value: `${Math.round(totalFiber)}g`, accent: colors.accentSecondary },
    { label: "Protein", value: `${Math.round(totalProtein)}g`, accent: colors.accentPrimary },
    { label: "Logged", value: `${loggedMealCount}/4`, accent: colors.accentTertiary },
  ];
  const gentleNudgeCopy =
    totalFiber < 15
      ? "A little extra fiber later could help the day feel steadier."
      : (todayQuickLog?.waterOz ?? 0) < (profile?.dailyWaterGoal ?? 64) * 0.5
        ? "Hydration looks a little light so far. A glass of water would help."
        : totalProtein < (profile?.dailyProteinGoal ?? 100) * 0.45
          ? "A little more protein later could keep your energy more stable."
          : "You're building a steadier day than it might feel in the moment.";

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
        loadTodayQuickLog(currentDate),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadTodayFoodLogs, loadTodayMoodLog, loadTodayQuickLog]);

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
      headerRight: () => (
        <View style={styles.headerPill}>
          <Ionicons name="leaf-outline" size={14} color={colors.accentPrimary} />
          <Text style={styles.headerPillText}>{loggedMealCount}</Text>
        </View>
      ),
    });
  }, [loggedMealCount, navigation, router]);

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
            <Text style={styles.logHeaderTitle}>
              {`${profile?.avatarEmoji ? `${profile.avatarEmoji} ` : ""}Hi${profile?.name ? `, ${profile.name}` : ""}`}
            </Text>
            <Text style={styles.logHeaderSubtitle}>
              {isSelectedDateToday
                ? todaySubtitle
                : `Looking back at ${format(selectedDate, "MMMM d")}.`}
            </Text>
          </View>

          {isSelectedDateToday ? (
            <View style={styles.moodArcCard}>
              <View style={styles.moodArcGraphic}>
                <View style={[styles.moodArcSegment, styles.moodArcSegmentShort]} />
                <View style={[styles.moodArcSegment, styles.moodArcSegmentRise]} />
                <View style={[styles.moodArcSegment, styles.moodArcSegmentDip]} />
                <View style={[styles.moodArcSegment, styles.moodArcSegmentLift]} />
              </View>
              <View style={styles.moodArcCopy}>
                <Text style={styles.moodArcLabel}>Today's mood arc</Text>
                <Text style={styles.moodArcText}>{moodArcSummary}</Text>
              </View>
            </View>
          ) : null}

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

            {isSelectedDateToday ? (
              <View style={styles.flowCard}>
                <View style={styles.flowHeader}>
                  <Text style={styles.flowEyebrow}>Today's Flow</Text>
                  <Text style={styles.flowMeta}>{loggedMealCount} of 4 logged</Text>
                </View>
                <View style={styles.flowList}>
                  {todayFlow.map((meal, index) => (
                    <View key={meal.meal} style={[styles.flowRow, index === todayFlow.length - 1 && styles.flowRowLast]}>
                      <View style={styles.flowTrack}>
                        <View
                          style={[
                            styles.flowDot,
                            { backgroundColor: meal.primary === "Not yet logged" ? "#E5D8CC" : mealAccentColors[meal.meal] },
                          ]}
                        />
                        {index < todayFlow.length - 1 ? <View style={styles.flowStem} /> : null}
                      </View>
                      <View style={styles.flowCopy}>
                        <Text style={styles.flowTitle}>{meal.primary}</Text>
                        <Text style={styles.flowSub}>
                          {meal.primary === "Not yet logged" ? meal.secondary : `${meal.secondary} · ${meal.calories} cal`}
                        </Text>
                      </View>
                      <Text style={styles.flowTime}>{meal.time}</Text>
                    </View>
                  ))}
                </View>
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
            {isSelectedDateToday ? (
              <View style={styles.glanceCard}>
                <View style={styles.glanceHeader}>
                  <Text style={styles.glanceEyebrow}>Today at a glance</Text>
                  <Text style={styles.glanceTrend}>
                    {todaysMood ? `Energy ${pastDayEnergyLabel}` : "Build your baseline"}
                  </Text>
                </View>
                <View style={styles.glanceGrid}>
                  {glanceStats.map((stat) => (
                    <View key={stat.label} style={styles.glanceStat}>
                      <View style={[styles.glanceRing, { borderColor: `${stat.accent}55` }]}>
                        <View style={[styles.glanceRingAccent, { borderTopColor: stat.accent, borderRightColor: stat.accent }]} />
                        <Text style={styles.glanceValue}>{stat.value}</Text>
                      </View>
                      <Text style={styles.glanceLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
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
            <Text style={styles.detailSectionLabel}>Detailed meals</Text>
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
            {isSelectedDateToday ? (
              <View style={styles.nudgeCard}>
                <View style={styles.nudgeIconWrap}>
                  <Ionicons name="leaf-outline" size={16} color={colors.accentSecondary} />
                </View>
                <View style={styles.nudgeCopy}>
                  <Text style={styles.nudgeEyebrow}>Gentle nudge</Text>
                  <Text style={styles.nudgeText}>{gentleNudgeCopy}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={colors.accentSecondary} />
              </View>
            ) : null}
            {isSelectedDateToday ? (
              <View style={styles.rewardCard}>
                <View style={styles.rewardBadge}>
                  <Ionicons name="star" size={16} color={colors.white} />
                </View>
                <View style={styles.rewardCopy}>
                  <Text style={styles.rewardEyebrow}>Built with care</Text>
                  <Text style={styles.rewardTitle}>You are showing up today</Text>
                  <Text style={styles.rewardText}>
                    {loggedMealCount > 0
                      ? `${loggedMealCount} of 4 meal moments are already in the story.`
                      : "Start with one meal and the rest of the picture gets easier to see."}
                  </Text>
                  <View style={styles.rewardProgressTrack}>
                    <View style={[styles.rewardProgressFill, { width: `${Math.max((loggedMealCount / 4) * 100, 12)}%` }]} />
                  </View>
                </View>
              </View>
            ) : null}
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
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: spacing.xl + 12,
  },
  screenStack: {
    gap: 18,
    width: "100%",
  },
  logHeader: {
    gap: 10,
    paddingTop: 6,
    paddingBottom: 2,
  },
  logHeaderDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logHeaderDate: {
    color: colors.textSecondary,
    fontSize: 14,
    letterSpacing: 0.4,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  dateNavButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1EAE1",
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.06)",
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
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "300",
  },
  dateNavTextDisabled: {
    color: colors.textSecondary,
  },
  logHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -1.3,
    fontFamily: editorialSerif,
  },
  logHeaderSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  headerPill: {
    marginRight: 14,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4E7D8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  headerPillText: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  moodArcCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  moodArcGraphic: {
    width: 64,
    height: 34,
    justifyContent: "center",
    gap: 4,
  },
  moodArcSegment: {
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.accentPrimary,
  },
  moodArcSegmentShort: {
    width: 22,
  },
  moodArcSegmentRise: {
    width: 38,
    marginLeft: 10,
  },
  moodArcSegmentDip: {
    width: 28,
    marginLeft: 24,
  },
  moodArcSegmentLift: {
    width: 44,
    marginLeft: 18,
  },
  moodArcCopy: {
    flex: 1,
    gap: 2,
  },
  moodArcLabel: {
    color: colors.accentPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  moodArcText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  flowCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
    gap: 16,
  },
  flowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  flowEyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  flowMeta: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  flowList: {
    gap: 4,
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 2,
  },
  flowRowLast: {
    paddingBottom: 0,
  },
  flowTrack: {
    width: 18,
    alignItems: "center",
  },
  flowDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6,
  },
  flowStem: {
    width: 1,
    flex: 1,
    minHeight: 24,
    backgroundColor: "rgba(44, 26, 14, 0.09)",
    marginTop: 4,
  },
  flowCopy: {
    flex: 1,
    gap: 3,
  },
  flowTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  flowSub: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  flowTime: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    paddingTop: 3,
  },
  pastMoodSummaryCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 16,
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
    height: 5,
    backgroundColor: "#E5DDD3",
    borderRadius: 999,
    marginTop: 2,
    marginHorizontal: 4,
    overflow: "hidden",
  },
  goalProgressFill: {
    height: 5,
    borderRadius: 999,
  },
  goalProgressLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "right",
    marginTop: 8,
    marginRight: 4,
  },
  glanceCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
    gap: 14,
  },
  glanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  glanceEyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  glanceTrend: {
    color: colors.accentSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  glanceGrid: {
    flexDirection: "row",
    gap: 10,
  },
  glanceStat: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#FEFCF8",
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
    borderRadius: 20,
  },
  glanceRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glanceRingAccent: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 29,
    borderWidth: 4,
    borderColor: "transparent",
  },
  glanceValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  glanceLabel: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  detailSectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  firstTimeEmpty: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: colors.white,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
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
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  firstTimeCTAText: {
    fontSize: 15,
    color: colors.accentPrimary,
    fontWeight: "600",
  },
  nudgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F8F7F0",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(138, 158, 123, 0.22)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nudgeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EEF3E9",
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeCopy: {
    flex: 1,
    gap: 3,
  },
  nudgeEyebrow: {
    color: colors.accentSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  nudgeText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  rewardCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rewardBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardCopy: {
    flex: 1,
    gap: 4,
  },
  rewardEyebrow: {
    color: colors.accentPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  rewardTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    fontFamily: editorialSerif,
  },
  rewardText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  rewardProgressTrack: {
    marginTop: 8,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E7DDD2",
    overflow: "hidden",
  },
  rewardProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accentTertiary,
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
