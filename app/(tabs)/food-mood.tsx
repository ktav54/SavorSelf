import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { InsightFeed, NutrientSpotlight, TrendCard, WeeklySnapshot } from "@/components/food-mood";
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
      <WeeklySnapshot />
      <InsightFeed />
      <TrendCard />
      <NutrientSpotlight />
    </Screen>
  );
}
