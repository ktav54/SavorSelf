import { useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import { StyleSheet, Text, View } from "react-native";
import {
  DailyReadCard,
  FoodMoodGate,
  GutMoodScoreCard,
  HorizontalInsightScroll,
  InsightFeed,
  NutrientSpotlight,
  StreakHeroCard,
  TrendCard,
  WeeklySnapshot,
} from "@/components/food-mood";
import { Screen } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useAppStore, type AppState } from "@/store/useAppStore";
import type { FoodLog } from "@/types/models";

export default function FoodMoodScreen() {
  const loadFoodMoodInsights = useAppStore((state: AppState) => state.loadFoodMoodInsights);
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);

  const hasEnoughData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 29);

    const moodDays = new Set(
      moodLogs
        .map((log) => new Date(log.loggedAt))
        .filter((date: Date) => date >= cutoff)
        .map((date: Date) => date.toISOString().slice(0, 10))
    );

    const foodDays = new Set(
      foodLogs
        .map((log: FoodLog) => new Date(log.loggedAt))
        .filter((date: Date) => date >= cutoff)
        .map((date: Date) => date.toISOString().slice(0, 10))
    );

    const pairedDays = Array.from(moodDays).filter((day: string) => foodDays.has(day)).length;
    return pairedDays >= 3;
  }, [foodLogs, moodLogs]);

  useFocusEffect(
    useCallback(() => {
      void loadFoodMoodInsights();
    }, [loadFoodMoodInsights])
  );

  return (
    <Screen scroll>
      <View style={styles.screenStack}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FOOD-MOOD</Text>
          <Text style={styles.title}>Your gut-brain picture</Text>
          <Text style={styles.subtitle}>{format(new Date(), "EEEE, MMMM d")}</Text>
        </View>
        {!hasEnoughData ? (
          <>
            <FoodMoodGate />
            <StreakHeroCard />
          </>
        ) : (
          <>
            <GutMoodScoreCard />
            <StreakHeroCard />
            <DailyReadCard />
            <TrendCard />
            <NutrientSpotlight />
            <HorizontalInsightScroll />
            <WeeklySnapshot />
            <InsightFeed />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenStack: {
    gap: 20,
    marginHorizontal: -4,
  },
  header: {
    gap: 6,
  },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
