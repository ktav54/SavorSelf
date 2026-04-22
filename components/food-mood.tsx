import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Chip, SectionTitle } from "@/components/ui";
import { sendCoachMessage } from "@/services/coach";
import { useAppStore, type AppState } from "@/store/useAppStore";
import { featureFlags } from "@/lib/premium";
import type { FoodLog, FoodMoodInsight, FoodMoodTrendPoint, MoodLog, QuickLog } from "@/types/models";

const PATTERN_WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAILY_READ_PROMPT =
  "Generate a short, warm, personalized daily gut-brain analysis for today. Use only the data provided in context — do not make up foods or moods. Cover: how today's food choices may be affecting mood and energy through the gut-brain axis, any standout nutrients or gaps, and one gentle actionable suggestion. Keep it to 3-4 sentences. Do not use bullet points. Speak directly to the user in second person, warm and non-judgmental tone.";

function toDateKey(value: Date | string) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getLastNDates(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - index));
    return date;
  });
}

function buildMoodByDate(moodLogs: MoodLog[]) {
  const map = new Map<string, number[]>();
  moodLogs.forEach((log) => {
    const key = toDateKey(log.loggedAt);
    map.set(key, [...(map.get(key) ?? []), log.moodScore]);
  });
  return new Map(Array.from(map.entries()).map(([key, scores]) => [key, average(scores)]));
}

function getCurrentMoodStreak(moodLogs: MoodLog[]) {
  const moodByDate = buildMoodByDate(moodLogs);
  let streak = 0;
  for (let index = 0; index < 28; index += 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - index);
    if (!moodByDate.has(toDateKey(date))) break;
    streak += 1;
  }
  return streak;
}

function getThreeDayTrend(moodLogs: MoodLog[]) {
  const moodByDate = buildMoodByDate(moodLogs);
  const recentSix = getLastNDates(6)
    .map((date) => moodByDate.get(toDateKey(date)) ?? null)
    .filter((value): value is number => value !== null);
  const recent = average(recentSix.slice(-3));
  const previous = average(recentSix.slice(0, 3));
  if (!recentSix.length || Math.abs(recent - previous) < 0.2) return "steady";
  return recent > previous ? "up" : "down";
}

function getTopFoodsByMood(
  moodLogs: MoodLog[],
  foodLogs: FoodLog[],
  limit: number
) {
  const moodByDate = buildMoodByDate(moodLogs);
  const grouped = new Map<string, number[]>();
  foodLogs.forEach((log) => {
    const mood = moodByDate.get(toDateKey(log.loggedAt));
    if (mood == null) return;
    grouped.set(log.foodName, [...(grouped.get(log.foodName) ?? []), mood]);
  });
  return Array.from(grouped.entries())
    .map(([foodName, moods]) => ({ foodName, count: moods.length, averageMood: average(moods) }))
    .filter((item) => item.count >= 2)
    .sort((left, right) => right.averageMood - left.averageMood)
    .slice(0, limit);
}

function getGutMoodScore(
  moodLogs: MoodLog[],
  foodLogs: FoodLog[]
) {
  const weekKeys = getLastNDates(7).map(toDateKey);
  const weeklyMoodLogs = moodLogs.filter((log) => weekKeys.includes(toDateKey(log.loggedAt)));
  const weeklyFoodLogs = foodLogs.filter((log) => weekKeys.includes(toDateKey(log.loggedAt)));
  const avgMood = average(weeklyMoodLogs.map((log) => log.moodScore));
  const avgFiber = average(
    weekKeys.map((key) =>
      weeklyFoodLogs
        .filter((log) => toDateKey(log.loggedAt) === key)
        .reduce((sum, log) => sum + log.fiberG, 0)
    )
  );
  const fermentedDays = weekKeys.filter((key) =>
    weeklyFoodLogs.some((log) => toDateKey(log.loggedAt) === key && log.gutHealthTags.includes("fermented"))
  ).length;
  const streak = Math.min(getCurrentMoodStreak(moodLogs), 7);
  return clamp(
    Math.round(
      50 +
        (avgMood / 5) * 20 +
        (Math.min(avgFiber, 30) / 30) * 15 +
        (fermentedDays / 7) * 10 +
        (streak / 7) * 5
    ),
    0,
    100
  );
}

function getGutMoodTone(score: number) {
  if (score < 40) {
    return {
      color: colors.mood[2],
      body: "Your body may be asking for more support right now.",
    };
  }
  if (score <= 60) {
    return {
      color: colors.accentTertiary,
      body: "You're in a building phase. Patterns are forming.",
    };
  }
  return {
    color: colors.accentSecondary,
    body: "Your food and mood are starting to work together.",
  };
}

function getWeeklySnapshotTitle(delta: number | null | undefined) {
  if (delta == null) return "Still building your picture";
  if (delta >= 0.5) return "A stronger week than last";
  if (delta <= -0.5) return "A gentler week - that's okay";
  return "Holding steady this week";
}

function getInsightMetricValue(
  insightType: string,
  point: FoodMoodTrendPoint
) {
  if (insightType.includes("protein")) return point.protein;
  if (insightType.includes("fermented")) return point.fermentedCount;
  if (insightType.includes("sleep")) return point.sleepHours;
  return point.fiber;
}

function getPairedDays(
  moodLogs: MoodLog[],
  foodLogs: FoodLog[]
) {
  const moodDays = new Set(moodLogs.map((log) => toDateKey(log.loggedAt)));
  const foodDays = new Set(foodLogs.map((log) => toDateKey(log.loggedAt)));
  return Array.from(moodDays).filter((day) => foodDays.has(day)).length;
}

function getNextMilestone(streak: number) {
  const milestones = [3, 7, 14, 30];
  return milestones.find((milestone) => milestone > streak) ?? 30;
}

function getMilestoneReward(milestone: number) {
  if (milestone <= 3) return "🔓 First pattern unlocks";
  if (milestone <= 7) return "🧠 Full Food-Mood picture";
  if (milestone <= 14) return "📈 Trend analysis ready";
  return "⭐ Deep gut-brain insights";
}

function EditorialHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.editorialHeader}>
      <Text style={styles.editorialEyebrow}>{eyebrow}</Text>
      <Text style={styles.editorialTitle}>{title}</Text>
      {subtitle ? <Text style={styles.editorialSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function EmptyPatternDots() {
  return (
    <View style={styles.dotsIllustration} pointerEvents="none">
      <View style={[styles.dot, styles.dotOne]} />
      <View style={[styles.dot, styles.dotTwo]} />
      <View style={[styles.dot, styles.dotThree]} />
      <View style={[styles.dot, styles.dotFour]} />
      <View style={[styles.dot, styles.dotFive]} />
      <View style={[styles.dot, styles.dotSix]} />
      <View style={[styles.dot, styles.dotSeven]} />
    </View>
  );
}

export function GutMoodScoreCard() {
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const score = useMemo(() => getGutMoodScore(moodLogs, foodLogs), [foodLogs, moodLogs]);
  const tone = getGutMoodTone(score);
  const scoreLeft = `${Math.min(Math.max(score, 4), 96)}%` as DimensionValue;

  return (
    <Card>
      <View style={styles.heroCard}>
        <Text style={styles.editorialEyebrow}>DAILY GUT ANALYSIS</Text>
        <Text style={[styles.heroScore, { color: tone.color }]}>{score}</Text>
        <Text style={styles.heroLabel}>Gut-Mood Score</Text>
        <Text style={styles.heroBody}>{tone.body}</Text>
        <View style={styles.scoreScaleWrap}>
          <View style={styles.scoreScaleTrack}>
            <View style={[styles.scoreScaleSegment, styles.scoreScaleLow]} />
            <View style={[styles.scoreScaleSegment, styles.scoreScaleMid]} />
            <View style={[styles.scoreScaleSegment, styles.scoreScaleHigh]} />
          </View>
          <View style={[styles.scorePointer, { left: scoreLeft }]} />
          <View style={styles.scoreScaleLabels}>
            <Text style={styles.scoreScaleLabel}>Low</Text>
            <Text style={styles.scoreScaleLabel}>Medium</Text>
            <Text style={styles.scoreScaleLabel}>High</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

export function FoodMoodGate() {
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const pairedDays = useMemo(() => getPairedDays(moodLogs, foodLogs), [foodLogs, moodLogs]);
  const hasMood = moodLogs.length > 0;
  const hasFood = foodLogs.length > 0;

  if (pairedDays >= 3) {
    return null;
  }

  return (
    <Card>
      <EditorialHeader
        eyebrow="GETTING STARTED"
        title="Food-Mood needs a few days to find your patterns"
        subtitle="Most people see their first real insight after just 3 consistent days."
      />
      <View style={styles.gateProgressWrap}>
        <Text style={styles.gateProgressLabel}>{pairedDays} of 3 days complete</Text>
        <View style={styles.gateRail}>
          <View
            style={[styles.gateFill, { width: `${Math.min((pairedDays / 3) * 100, 100)}%` }]}
          />
        </View>
      </View>
      <View style={styles.checklist}>
        <View style={styles.checklistRow}>
          <Text style={styles.checklistText}>📊 Log your mood</Text>
          <Text style={styles.checklistMark}>{hasMood ? "✓" : "○"}</Text>
        </View>
        <View style={styles.checklistRow}>
          <Text style={styles.checklistText}>🍽 Log at least one meal</Text>
          <Text style={styles.checklistMark}>{hasFood ? "✓" : "○"}</Text>
        </View>
        <View style={styles.checklistRow}>
          <Text style={styles.checklistText}>🔄 Do it again tomorrow</Text>
          <Text style={styles.checklistArrow}>→</Text>
        </View>
      </View>
    </Card>
  );
}

export function StreakHeroCard() {
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const streak = useMemo(() => getCurrentMoodStreak(moodLogs), [moodLogs]);

  if (streak === 0) {
    return (
      <Card>
        <SectionTitle
          title="Start your streak today"
          subtitle="Log your mood and one meal daily. Food-Mood gets smarter every single day you show up."
        />
      </Card>
    );
  }

  const nextMilestone = getNextMilestone(streak);
  const progress = Math.min((streak / nextMilestone) * 100, 100);

  return (
    <Card>
      <View style={styles.streakHero}>
        <Text style={styles.editorialEyebrow}>YOUR STREAK</Text>
        <Text style={styles.streakNumber}>
          {streak}
          {streak > 0 ? " 🔥" : ""}
        </Text>
        <Text style={styles.streakLabel}>day streak</Text>
        <View style={styles.gateProgressWrap}>
          <Text style={styles.gateProgressLabel}>
            {streak} / {nextMilestone} days
          </Text>
          <View style={styles.gateRail}>
            <View style={[styles.gateFill, { width: `${progress}%` }]} />
          </View>
        </View>
        <Text style={styles.milestoneReward}>{getMilestoneReward(nextMilestone)}</Text>
      </View>
    </Card>
  );
}

export function DailyReadCard() {
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const quickLogs = useAppStore((state: AppState) => state.quickLogs);
  const profile = useAppStore((state: AppState) => state.profile);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const todayMood = moodLogs[0] ?? null;
  const todayQuickLog = quickLogs[0] ?? null;
  const hasAnyTodayData = foodLogs.length > 0 || Boolean(todayMood);

  const totalCaloriesToday = useMemo(
    () => foodLogs.reduce((sum: number, food: FoodLog) => sum + food.calories, 0),
    [foodLogs]
  );
  const totalProteinToday = useMemo(
    () => foodLogs.reduce((sum: number, food: FoodLog) => sum + food.proteinG, 0),
    [foodLogs]
  );
  const totalFiberToday = useMemo(
    () => foodLogs.reduce((sum: number, food: FoodLog) => sum + food.fiberG, 0),
    [foodLogs]
  );
  const allGutTagsToday = useMemo(
    () => Array.from(new Set(foodLogs.flatMap((food: FoodLog) => food.gutHealthTags))),
    [foodLogs]
  );
  const foodDetails = useMemo(
    () =>
      foodLogs.map((food: FoodLog) => ({
        name: food.foodName,
        calories: food.calories,
        protein: food.proteinG,
        fiber: food.fiberG,
        gutHealthTags: food.gutHealthTags,
      })),
    [foodLogs]
  );
  const readContext = useMemo(
    () => ({
      moodLogs: moodLogs.slice(0, 1),
      foodSummary: {
        averageCalories: totalCaloriesToday,
        averageProtein: totalProteinToday,
        averageFiber: totalFiberToday,
        tags: allGutTagsToday,
        todaysFoods: foodLogs.map((food: FoodLog) => food.foodName).join(", "),
        foodDetails,
        waterOz: todayQuickLog?.waterOz ?? 0,
        sleepHours: todayQuickLog?.sleepHours ?? 0,
        caffeineMg: todayQuickLog?.caffeineMg ?? 0,
        calorieGoal: profile?.dailyCalorieGoal ?? null,
        proteinGoal: profile?.dailyProteinGoal ?? null,
        userName: profile?.name ?? "",
      },
      insights: [],
      quickLogs: quickLogs.slice(0, 1),
    }),
    [
      allGutTagsToday,
      foodDetails,
      foodLogs,
      moodLogs,
      profile?.dailyCalorieGoal,
      profile?.dailyProteinGoal,
      profile?.name,
      quickLogs,
      todayQuickLog?.caffeineMg,
      todayQuickLog?.sleepHours,
      todayQuickLog?.waterOz,
      totalCaloriesToday,
      totalFiberToday,
      totalProteinToday,
    ]
  );
  const readSignature = useMemo(
    () =>
      JSON.stringify({
        mood: todayMood
          ? {
              loggedAt: todayMood.loggedAt,
              moodScore: todayMood.moodScore,
              energyScore: todayMood.energyScore,
              physicalState: todayMood.physicalState,
              mentalState: todayMood.mentalState,
            }
          : null,
        foods: foodDetails,
        quickLog: todayQuickLog
          ? {
              waterOz: todayQuickLog.waterOz ?? 0,
              sleepHours: todayQuickLog.sleepHours ?? 0,
              caffeineMg: todayQuickLog.caffeineMg ?? 0,
            }
          : null,
        goals: {
          calorieGoal: profile?.dailyCalorieGoal ?? null,
          proteinGoal: profile?.dailyProteinGoal ?? null,
        },
      }),
    [
      foodDetails,
      profile?.dailyCalorieGoal,
      profile?.dailyProteinGoal,
      todayMood,
      todayQuickLog,
    ]
  );

  useEffect(() => {
    if (!hasAnyTodayData) {
      setReply("");
      setErrorMessage("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const generateRead = async () => {
      setLoading(true);
      setReply("");
      setErrorMessage("");

      try {
        const result = await sendCoachMessage(DAILY_READ_PROMPT, readContext);
        const nextReply = typeof result.reply === "string" ? result.reply.trim() : "";

        if (!nextReply) {
          throw new Error("Missing AI reply");
        }

        if (!cancelled) {
          setReply(nextReply);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("Couldn't generate your daily read right now. Try again later.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void generateRead();

    return () => {
      cancelled = true;
    };
  }, [hasAnyTodayData, readContext, readSignature, refreshCount]);

  return (
    <Card>
      <View style={styles.readHeroCard}>
        <View style={[styles.readGlow, styles.readGlowTop]} />
        <View style={[styles.readGlow, styles.readGlowBottom]} />
        <SectionTitle
          eyebrow="Today"
          title="Your daily read"
          subtitle="A warm, personalized gut-brain reflection based on what you've logged today."
        />
        {!hasAnyTodayData ? (
          <Text style={styles.note}>
            Log some food or check in with your mood first and I'll give you a read on your day.
          </Text>
        ) : loading ? (
          <Text style={styles.note}>Putting together your daily read...</Text>
        ) : errorMessage ? (
          <Text style={styles.note}>{errorMessage}</Text>
        ) : (
          <View style={styles.dailyReadBlock}>
            <Text style={styles.dailyRead}>{reply}</Text>
          </View>
        )}
        {hasAnyTodayData ? (
          <View style={styles.dailyReadFooter}>
            <Pressable disabled={loading} onPress={() => setRefreshCount((current) => current + 1)}>
              <Text style={styles.dailyReadRefreshLink}>Refresh</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export function HorizontalInsightScroll() {
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const foodLogsData = useAppStore((state: AppState) => state.foodLogs);
  const moodMap = useMemo(() => buildMoodByDate(moodLogs), [moodLogs]);
  const calendarDates = useMemo(() => getLastNDates(28), []);
  const betterDayFoods = useMemo(() => getTopFoodsByMood(moodLogs, foodLogsData, 4), [foodLogsData, moodLogs]);
  const pairedDays = useMemo(() => getPairedDays(moodLogs, foodLogsData), [foodLogsData, moodLogs]);
  const loggedMoodDays = useMemo(
    () => calendarDates.filter((date) => moodMap.has(toDateKey(date))).length,
    [calendarDates, moodMap]
  );
  const moodWeeks = useMemo(
    () => Array.from({ length: 4 }, (_, index) => calendarDates.slice(index * 7, index * 7 + 7)),
    [calendarDates]
  );
  const patternFoods = betterDayFoods.slice(0, 3);

  const getPatternMoodColor = (score?: number | null) => {
    const rounded = score == null ? null : clamp(Math.round(score), 1, 5);
    if (rounded == null) return "#EDE8E3";
    if (rounded === 1) return "#D4A89A";
    if (rounded === 2) return "#C9956A";
    if (rounded === 3) return "#B5C4A1";
    if (rounded === 4) return "#89A87C";
    return "#5C8A52";
  };

  return (
    <View style={styles.sectionWrap}>
      <EditorialHeader
        eyebrow="PATTERNS"
        title="What your data is saying"
        subtitle="A slower, more honest read of the connections taking shape."
      />
      <View style={styles.patternCardsStack}>
        <Card>
          <View style={styles.patternSurfaceCard}>
            <Text style={styles.editorialEyebrow}>MOOD MAP</Text>
            <Text style={styles.patternSurfaceTitle}>Your month at a glance</Text>
            <View style={styles.patternHeatmapWrap}>
              <View style={styles.patternWeekdayRow}>
                {PATTERN_WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.patternWeekdayText}>
                    {label}
                  </Text>
                ))}
              </View>
              <View style={styles.patternHeatmapRows}>
                {moodWeeks.map((week, weekIndex) => (
                  <View key={`pattern-week-${weekIndex}`} style={styles.patternHeatmapRow}>
                    {week.map((date, dayIndex) => (
                      <View
                        key={`pattern-day-${weekIndex}-${dayIndex}`}
                        style={[
                          styles.patternHeatmapCell,
                          { backgroundColor: getPatternMoodColor(moodMap.get(toDateKey(date))) },
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.patternMetaText}>{loggedMoodDays} of 28 days logged</Text>
          </View>
        </Card>
        <Card>
          <View style={styles.patternSurfaceCard}>
            <Text style={styles.editorialEyebrow}>YOUR PATTERN</Text>
            <Text style={styles.patternSurfaceTitle}>Foods that show up on your better days</Text>
            {pairedDays < 7 || !patternFoods.length ? (
              <View style={styles.patternEmptyState}>
                <Text style={styles.patternEmptyText}>
                  Log a few more days and Food-Mood will surface which foods tend to appear when you're
                  feeling your best.
                </Text>
              </View>
            ) : (
              <View style={styles.patternPillWrap}>
                {patternFoods.map((item) => (
                  <View key={item.foodName} style={styles.patternFoodPill}>
                    <Text style={styles.patternFoodPillText}>{item.foodName}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>
      </View>
    </View>
  );
}

export function MoodHeatmap() {
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);

  const cells = useMemo(() => {
    const moodMap = new Map(moodLogs.map((log) => [log.loggedAt.slice(0, 10), log.moodScore]));

    return Array.from({ length: 28 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (27 - index));
      const key = date.toISOString().slice(0, 10);
      const moodScore = moodMap.get(key) ?? null;
      const weekdayLabel = ["S", "M", "T", "W", "T", "F", "S"][date.getDay()];

      return {
        key,
        moodScore,
        weekdayLabel,
        dateNumber: date.getDate(),
      };
    });
  }, [moodLogs]);

  const firstWeek = cells.slice(0, 7);

  return (
    <Card>
      <SectionTitle
        eyebrow="Last 28 Days"
        title="Your mood at a glance"
        subtitle="A simple month view of how your check-ins have felt day to day."
      />
      <View style={styles.heatmapWeekdayRow}>
        {firstWeek.map((cell, index) => (
          <Text key={`weekday-${index}`} style={styles.heatmapWeekday}>
            {cell.weekdayLabel}
          </Text>
        ))}
      </View>
      <View style={styles.heatmapGrid}>
        {cells.map((cell, index) => (
          <View key={`cell-${index}`} style={styles.heatmapCellWrap}>
            <View
              style={[
                styles.heatmapCell,
                {
                  backgroundColor:
                    cell.moodScore === null ? colors.border : colors.mood[cell.moodScore],
                },
              ]}
            />
            <Text style={styles.heatmapDate}>{cell.dateNumber}</Text>
          </View>
        ))}
      </View>
      <View style={styles.heatmapLegend}>
        <Text style={styles.legendText}>Low</Text>
        <View style={styles.legendScale}>
          {[1, 2, 3, 4, 5].map((score) => (
            <View
              key={`legend-${score}`}
              style={[styles.legendBox, { backgroundColor: colors.mood[score as 1 | 2 | 3 | 4 | 5] }]}
            />
          ))}
        </View>
        <Text style={styles.legendText}>High</Text>
      </View>
    </Card>
  );
}

export function TopFoodsByMood() {
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);

  const topFoods = useMemo(() => {
    const moodByDate = new Map(moodLogs.map((log) => [log.loggedAt.slice(0, 10), log.moodScore]));
    const grouped = new Map<string, number[]>();

    foodLogs.forEach((log) => {
      const dayMood = moodByDate.get(log.loggedAt.slice(0, 10));
      if (dayMood == null) {
        return;
      }

      const current = grouped.get(log.foodName) ?? [];
      current.push(dayMood);
      grouped.set(log.foodName, current);
    });

    return Array.from(grouped.entries())
      .map(([foodName, moods]) => ({
        foodName,
        appearances: moods.length,
        averageMood: moods.reduce((sum, score) => sum + score, 0) / moods.length,
      }))
      .filter((item) => item.appearances >= 2)
      .sort((left, right) => right.averageMood - left.averageMood)
      .slice(0, 5);
  }, [foodLogs, moodLogs]);

  return (
    <Card>
      <SectionTitle
        eyebrow="Pattern"
        title="Foods that show up on your better days"
        subtitle={topFoods.length < 2 ? "A few more days of logging will unlock this." : undefined}
      />
      {topFoods.length >= 2 ? (
        <View style={styles.topFoodsList}>
          {topFoods.map((item, index) => (
            <View key={`row-${index}`} style={styles.topFoodRow}>
              <Text style={styles.topFoodName}>{item.foodName}</Text>
              <View style={styles.topFoodBarTrack}>
                <View
                  style={[
                    styles.topFoodBarFill,
                    {
                      width: Math.max((item.averageMood / 5) * 120, 12),
                    },
                  ]}
                />
              </View>
              <Text style={styles.topFoodScore}>{item.averageMood.toFixed(1)} / 5</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function WeeklySnapshot() {
  const snapshot = useAppStore((state: AppState) => state.foodMoodSnapshot);
  const insights = useAppStore((state: AppState) => state.insights);
  const weeklyLead = insights[0]?.insightBody;
  const isBuilding = snapshot?.moodDelta == null;

  return (
    <Card>
      <View style={styles.weeklySnapshotCard}>
        <EditorialHeader
          eyebrow="THIS WEEK"
          title={getWeeklySnapshotTitle(snapshot?.moodDelta)}
          subtitle={
            isBuilding
              ? "Your recent logs are starting to resolve into something more personal."
              : "A softer read on what your recent entries may be adding up to."
          }
        />
        {isBuilding ? <EmptyPatternDots /> : null}
        {weeklyLead ? <Text style={styles.note}>{weeklyLead}</Text> : null}
      </View>
    </Card>
  );
}

export function InsightFeed() {
  const insights = useAppStore((state: AppState) => state.insights);
  const insightsLoading = useAppStore((state: AppState) => state.insightsLoading);
  const insightsError = useAppStore((state: AppState) => state.insightsError);
  const trend = useAppStore((state: AppState) => state.foodMoodTrend);

  if (insightsLoading) {
    return (
      <Card>
        <SectionTitle
          eyebrow="INSIGHTS"
          title="Listening for your patterns"
          subtitle="Pulling together the last few weeks of logs so this feels personal."
        />
      </Card>
    );
  }

  if (insightsError) {
    return (
      <Card>
        <SectionTitle eyebrow="INSIGHTS" title="Your insight feed hit a snag" subtitle={insightsError} />
      </Card>
    );
  }

  if (!insights.length) {
    return (
      <Card>
        <SectionTitle
          eyebrow="INSIGHTS"
          title="Your insights will land here soon"
          subtitle="A few more food and mood check-ins will give this section something real to say."
        />
      </Card>
    );
  }

  return (
    <View style={styles.feed}>
      {insights.map((insight) => {
        const recentTrend = trend.slice(-7);
        const paddedTrend = Array.from({ length: 7 }, (_, index) => recentTrend[index - (7 - recentTrend.length)] ?? null);

        const getMoodStripColor = (score?: number | null) => {
          if (!score) {
            return "rgba(138, 158, 123, 0.16)";
          }

          if (score <= 1) {
            return "rgba(196, 98, 45, 0.28)";
          }

          if (score === 2) {
            return "rgba(210, 126, 74, 0.34)";
          }

          if (score === 3) {
            return "rgba(232, 168, 56, 0.4)";
          }

          if (score === 4) {
            return "rgba(170, 169, 102, 0.4)";
          }

          return "rgba(138, 158, 123, 0.48)";
        };

        return (
          <Card key={insight.id}>
            <Text style={styles.editorialEyebrow}>INSIGHTS</Text>
            <Text style={styles.insightBodyText}>{insight.insightBody}</Text>
            <View style={styles.insightTimelineRow}>
              <Text style={styles.insightTimelineLabel}>Last 7 days</Text>
              <View style={styles.insightTimelineStrip}>
                {paddedTrend.map((point, index) => (
                  <View
                    key={`${insight.id}-timeline-${index}`}
                    style={[
                      styles.insightTimelineCell,
                      {
                        backgroundColor: getMoodStripColor(point?.moodScore),
                        borderColor: point?.moodScore ? "rgba(44, 26, 14, 0.06)" : "rgba(138, 158, 123, 0.08)",
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.insightCaption}>Built from your actual food, mood, sleep, and habit logs.</Text>
          </Card>
        );
      })}
    </View>
  );
}

export function TrendCard() {
  return null;
  const profile = useAppStore((state: AppState) => state.profile);
  const trend = useAppStore((state: AppState) => state.foodMoodTrend);
  const canViewThirtyDay = featureFlags.canSeeThirtyDayTrends(profile);
  const points = trend.length ? trend : [];

  return (
    <Card>
      <SectionTitle
        eyebrow="Trend Graph"
        title="Your mood over the last 7 days"
        subtitle="Mood is plotted from your actual daily check-ins, with fiber shown underneath for context."
      />
      <View style={styles.trendArea}>
        {points.length ? (
          <>
            <View style={styles.gridLine} />
            <View style={[styles.gridLine, { top: 52 }]} />
            <View style={[styles.gridLine, { top: 90 }]} />
            <View style={styles.trendRow}>
              {points.map((point, index) => (
                <View key={`trend-${index}`} style={styles.trendColumn}>
                  <View
                    style={[
                      styles.fiberBar,
                      {
                        height: Math.max(6, point.fiber * 2),
                        backgroundColor: colors.accentSecondary,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.moodPoint,
                      {
                        bottom: point.moodScore ? point.moodScore * 22 : 0,
                        backgroundColor: point.moodScore ? colors.accentPrimary : "#CDB7A7",
                      },
                    ]}
                  />
                  {index < points.length - 1 && point.moodScore && points[index + 1].moodScore ? (
                    <View
                      style={[
                        styles.moodConnector,
                        {
                          bottom: ((point.moodScore + (points[index + 1].moodScore ?? point.moodScore)) / 2) * 22,
                        },
                      ]}
                    />
                  ) : null}
                  <Text style={styles.trendLabel}>{point.date.slice(5)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyTrendWrap}>
            <Text style={styles.note}>A few more check-ins will give this graph something real to show.</Text>
          </View>
        )}
      </View>
      <View style={styles.row}>
        <Chip label="7 days" active />
        <Chip label="Mood score" active />
        <Chip label="Fiber context" active />
        <Chip label="30 days" active={canViewThirtyDay} />
      </View>
      {!canViewThirtyDay ? (
        <Text style={styles.note}>The 30-day expanded view is still wrapped in your premium architecture.</Text>
      ) : null}
    </Card>
  );
}

export function NutrientSpotlight() {
  return null;
  const profile = useAppStore((state: AppState) => state.profile);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const isVisible = featureFlags.canSeeNutrientSpotlight(profile);
  const lowFiber = foodLogs.length ? foodLogs.reduce((sum, item) => sum + item.fiberG, 0) < 20 : false;

  return (
    <Card>
      <SectionTitle
        eyebrow="Nutrient Spotlight"
        title={
          isVisible
            ? lowFiber
              ? "Fiber has been running a little low lately"
              : "Your nutrient spotlight is starting to fill in"
            : "Nutrient spotlight is ready when premium turns on"
        }
        subtitle={
          isVisible
            ? lowFiber
              ? "That can shape mood steadiness and digestion. Your coach can help you find easy wins."
              : "Keep logging and this section will get more specific about what your body may be asking for."
            : "The permission check is already in place so this can activate later without a redesign."
        }
      />
    </Card>
  );
}

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatTag(tag?: string | null) {
  if (!tag) {
    return null;
  }

  return tag.replace(/_/g, " ");
}

function getInsightTrendKey(insightType: string) {
  if (insightType.includes("fiber")) return "fiber" as const;
  if (insightType.includes("protein")) return "protein" as const;
  if (insightType.includes("fermentedCount") || insightType.includes("fermented")) {
    return "fermentedCount" as const;
  }
  if (insightType.includes("sleepHours") || insightType.includes("sleep")) {
    return "sleepHours" as const;
  }

  return "fiber" as const;
}

const styles = StyleSheet.create({
  editorialHeader: {
    gap: 6,
  },
  editorialEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  editorialTitle: {
    fontSize: 26,
    lineHeight: 32,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  editorialSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  heroCard: {
    paddingVertical: 28,
    alignItems: "center",
    gap: spacing.md,
  },
  gateProgressWrap: {
    gap: spacing.xs,
  },
  gateProgressLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  gateRail: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  gateFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: colors.accentPrimary,
  },
  checklist: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  checklistText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  checklistMark: {
    fontSize: 18,
    color: colors.accentPrimary,
    fontWeight: "700",
  },
  checklistArrow: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  streakHero: {
    gap: spacing.md,
  },
  streakNumber: {
    fontSize: 72,
    fontWeight: "900",
    color: colors.accentPrimary,
  },
  streakLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  milestoneReward: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    fontWeight: "700",
    backgroundColor: "rgba(232, 168, 56, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  heroScore: {
    fontSize: 80,
    fontWeight: "800",
  },
  heroLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroBody: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.textSecondary,
    textAlign: "center",
  },
  scoreScaleWrap: {
    width: "100%",
    marginTop: spacing.xs,
    gap: 10,
    position: "relative",
  },
  scoreScaleTrack: {
    flexDirection: "row",
    height: 12,
    borderRadius: radii.round,
    overflow: "hidden",
  },
  scoreScaleSegment: {
    flex: 1,
  },
  scoreScaleLow: {
    backgroundColor: "#D9B7A0",
  },
  scoreScaleMid: {
    backgroundColor: colors.accentTertiary,
  },
  scoreScaleHigh: {
    backgroundColor: colors.accentSecondary,
  },
  scorePointer: {
    position: "absolute",
    top: -4,
    width: 16,
    height: 16,
    borderRadius: radii.round,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    marginLeft: -8,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  scoreScaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreScaleLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dailyRead: {
    fontSize: 16,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  dailyReadBlock: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
    borderRadius: 20,
    padding: 18,
  },
  dailyReadFooter: {
    alignItems: "flex-end",
  },
  dailyReadRefreshLink: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  readHeroCard: {
    borderRadius: 24,
    padding: spacing.md,
    overflow: "hidden",
    gap: spacing.md,
    backgroundColor: "#F7EEE5",
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.08)",
    shadowColor: "#B77C54",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  readGlow: {
    position: "absolute",
    borderRadius: radii.round,
    opacity: 0.8,
  },
  readGlowTop: {
    width: 180,
    height: 180,
    right: -40,
    top: -60,
    backgroundColor: "rgba(232, 168, 56, 0.16)",
  },
  readGlowBottom: {
    width: 180,
    height: 180,
    left: -50,
    bottom: -90,
    backgroundColor: "rgba(138, 158, 123, 0.16)",
  },
  heroBadgeRow: {
    alignItems: "flex-start",
  },
  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.08)",
  },
  heroMetaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  sectionWrap: {
    gap: 20,
  },
  patternCardsStack: {
    gap: spacing.md,
  },
  patternSurfaceCard: {
    gap: spacing.md,
  },
  patternSurfaceTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  patternHeatmapWrap: {
    gap: 10,
  },
  patternWeekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  patternWeekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  patternHeatmapRows: {
    gap: 6,
  },
  patternHeatmapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  patternHeatmapCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
  },
  patternMetaText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  patternEmptyState: {
    backgroundColor: "rgba(255,255,255,0.58)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.06)",
    padding: 18,
  },
  patternEmptyText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  patternPillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  patternFoodPill: {
    borderRadius: radii.round,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.28)",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  patternFoodPillText: {
    fontSize: 14,
    color: colors.accentPrimary,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  dotsIllustration: {
    height: 130,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.5)",
    overflow: "hidden",
    position: "relative",
    marginVertical: spacing.xs,
  },
  dot: {
    position: "absolute",
    borderRadius: radii.round,
  },
  dotOne: {
    width: 18,
    height: 18,
    left: "20%",
    top: 28,
    backgroundColor: "rgba(196, 98, 45, 0.24)",
  },
  dotTwo: {
    width: 22,
    height: 22,
    left: "42%",
    top: 18,
    backgroundColor: "rgba(232, 168, 56, 0.22)",
  },
  dotThree: {
    width: 16,
    height: 16,
    right: "26%",
    top: 42,
    backgroundColor: "rgba(143, 182, 216, 0.28)",
  },
  dotFour: {
    width: 28,
    height: 28,
    left: "34%",
    bottom: 26,
    backgroundColor: "rgba(138, 158, 123, 0.24)",
  },
  dotFive: {
    width: 14,
    height: 14,
    right: "20%",
    bottom: 34,
    backgroundColor: "rgba(196, 98, 45, 0.18)",
  },
  dotSix: {
    width: 10,
    height: 10,
    left: "54%",
    bottom: 22,
    backgroundColor: "rgba(143, 182, 216, 0.3)",
  },
  dotSeven: {
    width: 42,
    height: 42,
    left: "46%",
    top: "38%",
    marginLeft: -21,
    marginTop: -21,
    backgroundColor: "rgba(255,255,255,0.38)",
  },
  consistencyRow: {
    gap: 2,
    marginBottom: spacing.sm,
  },
  consistencyValue: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  consistencyLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sparklineWrap: {
    height: 60,
    marginTop: spacing.xs,
    position: "relative",
  },
  sparklineDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  insightBodyText: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  insightTimelineRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  insightTimelineLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  insightTimelineStrip: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  insightTimelineCell: {
    width: 18,
    height: 18,
    borderRadius: 7,
    borderWidth: 1,
  },
  insightCaption: {
    color: colors.textSecondary,
    lineHeight: 22,
    fontSize: 14,
  },
  heatmapWeekdayRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 6,
  },
  heatmapWeekday: {
    width: 32,
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: "center",
    textTransform: "uppercase",
  },
  heatmapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  heatmapCellWrap: {
    width: 32,
    alignItems: "center",
    gap: 4,
  },
  heatmapCell: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  heatmapDate: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  heatmapLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  legendScale: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  legendBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
  },
  topFoodsList: {
    gap: spacing.sm,
  },
  topFoodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  topFoodName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  topFoodBarTrack: {
    width: 120,
    height: 10,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  topFoodBarFill: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.accentSecondary,
  },
  topFoodScore: {
    width: 46,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "right",
  },
  snapshotRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    gap: 6,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  note: {
    color: colors.textSecondary,
    lineHeight: 24,
    fontSize: 15,
  },
  feed: {
    gap: 20,
  },
  weeklySnapshotCard: {
    backgroundColor: "rgba(232, 168, 56, 0.08)",
    borderRadius: 22,
    padding: 18,
    gap: spacing.sm,
  },
  sparkline: {
    height: 80,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    position: "relative",
  },
  sparklineBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flex: 1,
    height: "100%",
  },
  sparklineColumn: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  nutrientBar: {
    width: 8,
    borderRadius: radii.round,
    backgroundColor: colors.accentSecondary,
    opacity: 0.75,
    marginBottom: 10,
  },
  moodDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: radii.round,
    backgroundColor: colors.accentPrimary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  sparklineLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  trendArea: {
    minHeight: 180,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    position: "relative",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 10,
  },
  gridLine: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 16,
    height: 1,
    backgroundColor: colors.border,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flex: 1,
  },
  trendColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 150,
    position: "relative",
  },
  fiberBar: {
    width: 12,
    borderRadius: 8,
    opacity: 0.6,
    marginBottom: 8,
  },
  moodPoint: {
    width: 12,
    height: 12,
    borderRadius: radii.round,
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.background,
  },
  moodConnector: {
    position: "absolute",
    width: "100%",
    height: 2,
    backgroundColor: colors.accentPrimary,
    opacity: 0.35,
  },
  trendLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 8,
  },
  emptyTrendWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});

