import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { router, useNavigation } from "expo-router";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
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
  const navigation = useNavigation();
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
  const [screenError, setScreenError] = useState<string | null>(null);
  const todayFormatted = format(new Date(), "EEEE, MMMM d");

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
      let active = true;

      void (async () => {
        try {
          await loadFoodMoodInsights();
          if (active) {
            setScreenError(null);
          }
        } catch {
          if (active) {
            setScreenError("Something went wrong loading your Food-Mood data.");
          }
        }
      })();

      return () => {
        active = false;
      };
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Food-Mood",
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
  }, [navigation]);

  return (
    <Screen scroll>
      <View style={styles.screenStack}>
        <View style={styles.header}>
          <Text style={styles.title}>Your gut-brain picture</Text>
          <Text style={styles.subtitle}>{todayFormatted}</Text>
        </View>
        {screenError ? (
          <View style={styles.screenError}>
            <Text style={styles.screenErrorEmoji}>🌥️</Text>
            <Text style={styles.screenErrorTitle}>Something went wrong</Text>
            <Text style={styles.screenErrorSub}>{screenError}</Text>
            <Pressable
              style={({ pressed }) => [styles.screenErrorRetry, pressed && { opacity: 0.8 }]}
              onPress={() => {
                setScreenError(null);
                void (async () => {
                  try {
                    await loadFoodMoodInsights();
                  } catch {
                    setScreenError("Something went wrong loading your Food-Mood data.");
                  }
                })();
              }}
            >
              <Text style={styles.screenErrorRetryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {!screenError && shouldShowLoadingState ? (
          <>
            {[1, 2, 3].map((item) => (
              <Animated.View key={item} style={[styles.skeletonCard, { opacity: skeletonAnim }]} />
            ))}
          </>
        ) : null}
        {!screenError && !shouldShowLoadingState && !hasEnoughData ? (
          <Animated.View style={{ opacity: gateAnim, flex: 1 }}>
            <FoodMoodGate />
            <StreakHeroCard />
          </Animated.View>
        ) : !screenError && !shouldShowLoadingState ? (
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
  screenError: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  screenErrorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  screenErrorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  screenErrorSub: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  screenErrorRetry: {
    backgroundColor: "#F6EDE4",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  screenErrorRetryText: {
    fontSize: 15,
    color: colors.accentPrimary,
    fontWeight: "600",
  },
});
