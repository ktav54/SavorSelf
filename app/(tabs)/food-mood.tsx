import { useCallback } from "react";
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

  useFocusEffect(
    useCallback(() => {
      void loadFoodMoodInsights();
    }, [loadFoodMoodInsights])
  );

  return (
    <Screen scroll>
      <FoodMoodGate />
      <GutMoodScoreCard />
      <StreakHeroCard />
      <DailyReadCard />
      <HorizontalInsightScroll />
      <WeeklySnapshot />
      <InsightFeed />
    </Screen>
  );
}
