import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import { Animated, StyleSheet, Text, View } from "react-native";
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
  const insightsLoading = useAppStore((state: AppState) => state.insightsLoading);
  const insights = useAppStore((state: AppState) => state.insights);
  const foodMoodSnapshot = useAppStore((state: AppState) => state.foodMoodSnapshot);
  const foodMoodTrend = useAppStore((state: AppState) => state.foodMoodTrend);
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const cardAnims = useRef(
    Array.from({ length: 6 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
    }))
  ).current;
  const gateAnim = useRef(new Animated.Value(0)).current;
  const skeletonAnim = useRef(new Animated.Value(0.4)).current;

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

  useEffect(() => {
    Animated.timing(gateAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [gateAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonAnim, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [skeletonAnim]);

  useEffect(() => {
    if (hasEnoughData) {
      cardAnims.forEach((anim, i) => {
        anim.opacity.setValue(0);
        anim.translateY.setValue(20);
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 350,
            delay: i * 80,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: 0,
            duration: 350,
            delay: i * 80,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [cardAnims, hasEnoughData]);

  const shouldShowLoadingState =
    insightsLoading && insights.length === 0 && foodMoodTrend.length === 0 && foodMoodSnapshot === null;

  return (
    <Screen scroll>
      <View style={styles.screenStack}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FOOD-MOOD</Text>
          <Text style={styles.title}>Your gut-brain picture</Text>
          <Text style={styles.subtitle}>{format(new Date(), "EEEE, MMMM d")}</Text>
        </View>
        {shouldShowLoadingState ? (
          <>
            {[1, 2, 3].map((item) => (
              <Animated.View key={item} style={[styles.skeletonCard, { opacity: skeletonAnim }]} />
            ))}
          </>
        ) : null}
        {!shouldShowLoadingState && !hasEnoughData ? (
          <Animated.View style={{ opacity: gateAnim, flex: 1 }}>
            <FoodMoodGate />
            <StreakHeroCard />
          </Animated.View>
        ) : !shouldShowLoadingState ? (
          <>
            <Animated.View
              style={{
                opacity: cardAnims[0].opacity,
                transform: [{ translateY: cardAnims[0].translateY }],
              }}
            >
              <GutMoodScoreCard />
            </Animated.View>
            <Animated.View
              style={{
                opacity: cardAnims[1].opacity,
                transform: [{ translateY: cardAnims[1].translateY }],
              }}
            >
              <DailyReadCard />
            </Animated.View>
            <Animated.View
              style={{
                opacity: cardAnims[2].opacity,
                transform: [{ translateY: cardAnims[2].translateY }],
              }}
            >
              <StreakHeroCard />
            </Animated.View>
            <Animated.View
              style={{
                opacity: cardAnims[3].opacity,
                transform: [{ translateY: cardAnims[3].translateY }],
              }}
            >
              <TrendCard />
            </Animated.View>
            <NutrientSpotlight />
            <HorizontalInsightScroll />
            <Animated.View
              style={{
                opacity: cardAnims[4].opacity,
                transform: [{ translateY: cardAnims[4].translateY }],
              }}
            >
              <WeeklySnapshot />
            </Animated.View>
            <Animated.View
              style={{
                opacity: cardAnims[5].opacity,
                transform: [{ translateY: cardAnims[5].translateY }],
              }}
            >
              <InsightFeed />
            </Animated.View>
          </>
        ) : null}
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
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  skeletonCard: {
    height: 120,
    borderRadius: 16,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
});
