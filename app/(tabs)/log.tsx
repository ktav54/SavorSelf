import { useFocusEffect } from "@react-navigation/native";
import { addDays, format, isToday } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
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

export default function LogScreen() {
  const profile = useAppStore((state: AppState) => state.profile);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const selectedDate = useAppStore((state: AppState) => state.selectedDate);
  const setSelectedDate = useAppStore((state: AppState) => state.setSelectedDate);
  const loadTodayMoodLog = useAppStore((state: AppState) => state.loadTodayMoodLog);
  const loadTodayFoodLogs = useAppStore((state: AppState) => state.loadTodayFoodLogs);
  const loadTodayQuickLog = useAppStore((state: AppState) => state.loadTodayQuickLog);
  const [defaultMealType, setDefaultMealType] = useState<MealType>("breakfast");
  const [mealContext, setMealContext] = useState<MealType | null>(null);
  const [foodSearchVisible, setFoodSearchVisible] = useState(false);
  const [entryStep, setEntryStep] = useState<EntryStep>("hidden");
  const hasShownEntryThisSession = useRef(false);
  const touchStartX = useRef(0);
  const heroRise = useRef(new Animated.Value(24)).current;
  const heroFade = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const pillPulse = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      const currentDate = useAppStore.getState().selectedDate;
      void loadTodayMoodLog(currentDate);
      void loadTodayFoodLogs(currentDate);
      void loadTodayQuickLog(currentDate);

      if (!hasShownEntryThisSession.current && isToday(currentDate)) {
        hasShownEntryThisSession.current = true;
        setEntryStep("welcome");
      }
    }, [loadTodayFoodLogs, loadTodayMoodLog, loadTodayQuickLog])
  );

  const isSelectedDateToday = isToday(selectedDate);

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
  const logHeaderDate = format(selectedDate, "EEE MMM d yyyy").toUpperCase();
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

  return (
    <>
      <Screen scroll>
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
              <Pressable style={({ pressed }) => [styles.dateNavButton, pressed && styles.dateNavPressed]} onPress={goToPreviousDay}>
                <Text style={styles.dateNavText}>{"<"}</Text>
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
              >
                <Text style={[styles.dateNavText, isSelectedDateToday && styles.dateNavTextDisabled]}>{">"}</Text>
              </Pressable>
            </View>
            <Text style={styles.logHeaderTitle}>{`Hi${profile?.name ? `, ${profile.name}` : ""}`}</Text>
            <Text style={styles.logHeaderSubtitle}>
              {isSelectedDateToday
                ? "Today stays simple: check in, add what you ate, and let the patterns build gently."
                : `Looking back at ${format(selectedDate, "MMMM d")}. Food comes first here, with your saved mood note tucked above.`}
            </Text>
          </View>

          {isSelectedDateToday ? <MoodCheckInStrip /> : <MoodCheckInStrip compact />}

          {isSelectedDateToday ? <MacroSummaryBar /> : null}
          <FoodSearchLauncher onPress={openGeneralFoodSearch} />
          <FoodSearchCard
            visible={foodSearchVisible}
            onRequestClose={closeFoodSearch}
            defaultMealType={defaultMealType}
            title={generalFoodTitle}
          />
          <FoodLogSection mealType="breakfast" logs={foodLogs.filter((item: FoodLog) => item.mealType === "breakfast")} onAddFood={() => openFoodSearch("breakfast")} />
          <FoodLogSection mealType="lunch" logs={foodLogs.filter((item: FoodLog) => item.mealType === "lunch")} onAddFood={() => openFoodSearch("lunch")} />
          <FoodLogSection mealType="dinner" logs={foodLogs.filter((item: FoodLog) => item.mealType === "dinner")} onAddFood={() => openFoodSearch("dinner")} />
          <FoodLogSection mealType="snack" logs={foodLogs.filter((item: FoodLog) => item.mealType === "snack")} onAddFood={() => openFoodSearch("snack")} />
          {!isSelectedDateToday ? <MacroSummaryBar /> : null}
          <HydrationSummaryCard />
          <QuickLogStrip />
        </View>
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
            <ScrollView contentContainerStyle={styles.entryScrollContent} showsVerticalScrollIndicator={false}>
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
  screenStack: {
    gap: 20,
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
    textTransform: "uppercase",
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
  },
  dateNavPressed: {
    opacity: 0.7,
  },
  dateNavText: {
    color: colors.accentPrimary,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: "700",
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
    maxWidth: "94%",
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
