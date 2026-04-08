import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { Screen, SectionTitle } from "@/components/ui";
import { FoodLogSection, FoodSearchCard, GraceModeCard, MacroSummaryBar, MoodCheckInStrip, QuickLogStrip } from "@/components/log";
import { useAppStore } from "@/store/useAppStore";

export default function LogScreen() {
  const profile = useAppStore((state) => state.profile);
  const foodLogs = useAppStore((state) => state.foodLogs);
  const loadTodayMoodLog = useAppStore((state) => state.loadTodayMoodLog);
  const loadTodayFoodLogs = useAppStore((state) => state.loadTodayFoodLogs);

  useFocusEffect(
    useCallback(() => {
      void loadTodayMoodLog();
      void loadTodayFoodLogs();
    }, [loadTodayFoodLogs, loadTodayMoodLog])
  );

  return (
    <Screen scroll>
      <SectionTitle
        eyebrow={new Date().toDateString()}
        title={`Hi${profile?.name ? `, ${profile.name}` : ""}`}
        subtitle="Mood first, then the gentle details that help you connect meals and feelings over time."
      />
      <MoodCheckInStrip />
      <MacroSummaryBar />
      <FoodSearchCard />
      <FoodLogSection mealType="breakfast" logs={foodLogs.filter((item) => item.mealType === "breakfast")} />
      <FoodLogSection mealType="lunch" logs={foodLogs.filter((item) => item.mealType === "lunch")} />
      <FoodLogSection mealType="dinner" logs={foodLogs.filter((item) => item.mealType === "dinner")} />
      <FoodLogSection mealType="snack" logs={foodLogs.filter((item) => item.mealType === "snack")} />
      <QuickLogStrip />
      <GraceModeCard />
    </Screen>
  );
}
