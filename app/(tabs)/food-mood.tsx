import { useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  DailyReadCard,
  FoodMoodGate,
  GutMoodScoreCard,
  HorizontalInsightScroll,
  InsightFeed,
  StreakHeroCard,
  WeeklySnapshot,
} from "@/components/food-mood";
import { Screen } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export default function FoodMoodScreen() {
  const loadFoodMoodInsights = useAppStore((state) => state.loadFoodMoodInsights);
  const moodLogs = useAppStore((state) => state.moodLogs);
  const foodLogs = useAppStore((state) => state.foodLogs);

  const hasEnoughData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 29);

    const moodDays = new Set(
      moodLogs
        .map((log) => new Date(log.loggedAt))
        .filter((date) => date >= cutoff)
        .map((date) => date.toISOString().slice(0, 10))
    );

    const foodDays = new Set(
      foodLogs
        .map((log) => new Date(log.loggedAt))
        .filter((date) => date >= cutoff)
        .map((date) => date.toISOString().slice(0, 10))
    );

    const pairedDays = Array.from(moodDays).filter((day) => foodDays.has(day)).length;
    return pairedDays >= 3;
  }, [foodLogs, moodLogs]);

  useFocusEffect(
    useCallback(() => {
      void loadFoodMoodInsights();
    }, [loadFoodMoodInsights])
  );

  return (
    <Screen scroll>
      <FoodMoodGate />
      <StreakHeroCard />
      {hasEnoughData ? (
        <>
          <GutMoodScoreCard />
          <DailyReadCard />
          <HorizontalInsightScroll />
          <WeeklySnapshot />
          <InsightFeed />
        </>
      ) : null}
    </Screen>
  );
}
