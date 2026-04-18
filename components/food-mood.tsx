import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Chip, PrimaryButton, SectionTitle } from "@/components/ui";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { featureFlags } from "@/lib/premium";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

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

function buildMoodByDate(moodLogs: ReturnType<typeof useAppStore.getState>["moodLogs"]) {
  const map = new Map<string, number[]>();
  moodLogs.forEach((log) => {
    const key = toDateKey(log.loggedAt);
    map.set(key, [...(map.get(key) ?? []), log.moodScore]);
  });
  return new Map(Array.from(map.entries()).map(([key, scores]) => [key, average(scores)]));
}

function getCurrentMoodStreak(moodLogs: ReturnType<typeof useAppStore.getState>["moodLogs"]) {
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

function getThreeDayTrend(moodLogs: ReturnType<typeof useAppStore.getState>["moodLogs"]) {
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
  moodLogs: ReturnType<typeof useAppStore.getState>["moodLogs"],
  foodLogs: ReturnType<typeof useAppStore.getState>["foodLogs"],
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

function buildDailyReadPrompt(
  moodLogs: ReturnType<typeof useAppStore.getState>["moodLogs"],
  foodLogs: ReturnType<typeof useAppStore.getState>["foodLogs"],
  trend: ReturnType<typeof useAppStore.getState>["foodMoodTrend"]
) {
  const todayMood = moodLogs[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayFoods = foodLogs.filter((log) => toDateKey(log.loggedAt) === toDateKey(yesterday));
  const totalFiber = Math.round(yesterdayFoods.reduce((sum, log) => sum + log.fiberG, 0));
  const totalProtein = Math.round(yesterdayFoods.reduce((sum, log) => sum + log.proteinG, 0));
  const last3Moods = trend.slice(-3).map((point) => point.moodScore ?? "none").join(", ");
  return `Today's mood: ${todayMood?.moodScore ?? "unknown"}/5. Physical: ${(todayMood?.physicalState ?? []).join(", ") || "none"}. Mental: ${(todayMood?.mentalState ?? []).join(", ") || "none"}. Yesterday's foods: ${yesterdayFoods.map((food) => food.foodName).join(", ") || "none"} (fiber: ${totalFiber}g, protein: ${totalProtein}g). Last 3 mood scores: ${last3Moods || "none"}. Write 2-3 warm, specific sentences connecting yesterday's food to today's mood. Reference actual foods by name. Be personal not generic.`;
}

function getGutMoodScore(
  moodLogs: ReturnType<typeof useAppStore.getState>["moodLogs"],
  foodLogs: ReturnType<typeof useAppStore.getState>["foodLogs"]
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
  point: ReturnType<typeof useAppStore.getState>["foodMoodTrend"][number]
) {
  if (insightType.includes("protein")) return point.protein;
  if (insightType.includes("fermented")) return point.fermentedCount;
  if (insightType.includes("sleep")) return point.sleepHours;
  return point.fiber;
}

function getPairedDays(
  moodLogs: ReturnType<typeof useAppStore.getState>["moodLogs"],
  foodLogs: ReturnType<typeof useAppStore.getState>["foodLogs"]
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

export function GutMoodScoreCard() {
  const moodLogs = useAppStore((state) => state.moodLogs);
  const foodLogs = useAppStore((state) => state.foodLogs);
  const score = useMemo(() => getGutMoodScore(moodLogs, foodLogs), [foodLogs, moodLogs]);
  const tone = getGutMoodTone(score);

  return (
    <Card>
      <View style={styles.heroCard}>
        <Text style={[styles.heroScore, { color: tone.color }]}>{score}</Text>
        <Text style={styles.heroLabel}>Gut-Mood Score</Text>
        <Text style={styles.heroBody}>{tone.body}</Text>
        <View style={styles.progressRail}>
          <View style={[styles.progressFill, { width: `${score}%`, backgroundColor: tone.color }]} />
        </View>
      </View>
    </Card>
  );
}

export function FoodMoodGate() {
  const moodLogs = useAppStore((state) => state.moodLogs);
  const foodLogs = useAppStore((state) => state.foodLogs);
  const pairedDays = useMemo(() => getPairedDays(moodLogs, foodLogs), [foodLogs, moodLogs]);
  const hasMood = moodLogs.length > 0;
  const hasFood = foodLogs.length > 0;

  if (pairedDays >= 3) {
    return null;
  }

  return (
    <Card>
      <SectionTitle
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
          <Text style={styles.checklistText}>Log your mood</Text>
          <Text style={styles.checklistMark}>{hasMood ? "✓" : "○"}</Text>
        </View>
        <View style={styles.checklistRow}>
          <Text style={styles.checklistText}>Log at least one meal</Text>
          <Text style={styles.checklistMark}>{hasFood ? "✓" : "○"}</Text>
        </View>
        <View style={styles.checklistRow}>
          <Text style={styles.checklistText}>Do it again tomorrow</Text>
          <Text style={styles.checklistArrow}>→</Text>
        </View>
      </View>
    </Card>
  );
}

export function StreakHeroCard() {
  const moodLogs = useAppStore((state) => state.moodLogs);
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
        <Text style={styles.streakNumber}>{streak}</Text>
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
  const moodLogs = useAppStore((state) => state.moodLogs);
  const foodLogs = useAppStore((state) => state.foodLogs);
  const foodMoodTrend = useAppStore((state) => state.foodMoodTrend);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const todayMood = moodLogs[0];

  const getRead = async () => {
    if (!todayMood) return;
    setLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: buildDailyReadPrompt(moodLogs, foodLogs, foodMoodTrend),
          context: {},
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error();
      setReply(typeof data?.reply === "string" ? data.reply : "");
    } catch {
      setReply("I couldn't generate your read right now. Try again in a moment.");
    } finally {
      setHasLoaded(true);
      setLoading(false);
    }
  };

  if (!todayMood) {
    return (
      <Card>
        <SectionTitle
          eyebrow="TODAY"
          title="Why do I feel this way?"
          subtitle="Log today's mood first to unlock your daily read."
        />
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle eyebrow="TODAY" title="Why do I feel this way?" />
      {hasLoaded ? (
        <>
          <Text style={styles.dailyRead}>{reply}</Text>
          <PrimaryButton label="Refresh" secondary onPress={() => setHasLoaded(false)} />
        </>
      ) : (
        <PrimaryButton
          label={loading ? "Thinking..." : "Get my read"}
          secondary
          onPress={loading ? undefined : () => void getRead()}
        />
      )}
    </Card>
  );
}

export function HorizontalInsightScroll() {
  const moodLogs = useAppStore((state) => state.moodLogs);
  const foodLogsData = useAppStore((state) => state.foodLogs);
  const moodMap = useMemo(() => buildMoodByDate(moodLogs), [moodLogs]);
  const calendarDates = useMemo(() => getLastNDates(28), []);
  const betterDayFoods = useMemo(() => getTopFoodsByMood(moodLogs, foodLogsData, 4), [foodLogsData, moodLogs]);

  return (
    <View style={styles.sectionWrap}>
      <SectionTitle eyebrow="PATTERNS" title="What your data is saying" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalContent}>
        <View style={styles.scrollCard}>
          <Text style={styles.scrollCardTitle}>28-day mood</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={`dow-${index}`} style={styles.weekdayText}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.heatmapGrid}>
            {calendarDates.map((date, index) => {
              const key = toDateKey(date);
              const moodScore = moodMap.get(key);
              return (
                <View key={`heat-${index}`} style={styles.heatmapCellWrap}>
                  <View
                    style={[
                      styles.heatmapCell,
                      {
                        backgroundColor: moodScore
                          ? colors.mood[Math.round(moodScore) as 1 | 2 | 3 | 4 | 5]
                          : colors.border,
                      },
                    ]}
                  />
                  <Text style={styles.dateText}>{date.getDate()}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.scrollCard}>
          <Text style={styles.scrollCardTitle}>On your better days</Text>
          {betterDayFoods.length >= 2 ? (
            betterDayFoods.map((item, index) => (
              <View key={`food-${index}`} style={styles.foodRow}>
                <Text style={styles.foodName}>{item.foodName}</Text>
                <View style={styles.foodBarTrack}>
                  <View
                    style={[styles.foodBarFill, { width: Math.max((item.averageMood / 5) * 120, 12) }]}
                  />
                </View>
                <Text style={styles.foodScore}>{item.averageMood.toFixed(1)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Keep logging to unlock this pattern.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );

  const { streak, trendDirection } = useMemo(() => {
    const moodByDate = new Map<string, number[]>();

    moodLogs.forEach((log) => {
      const key = log.loggedAt.slice(0, 10);
      const existing = moodByDate.get(key) ?? [];
      existing.push(log.moodScore);
      moodByDate.set(key, existing);
    });

    let streakCount = 0;
    for (let index = 0; index < 28; index += 1) {
      const day = new Date();
      day.setDate(day.getDate() - index);
      const key = day.toISOString().slice(0, 10);
      if (moodByDate.has(key)) {
        streakCount += 1;
      } else {
        break;
      }
    }

    const recentSixDays = Array.from({ length: 6 }).map((_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (5 - index));
      const key = day.toISOString().slice(0, 10);
      const scores = moodByDate.get(key) ?? [];
      return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    });

    const lastThree = recentSixDays.slice(-3).filter((value): value is number => value !== null);
    const previousThree = recentSixDays.slice(0, 3).filter((value): value is number => value !== null);

    const average = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

    const lastThreeAverage = average(lastThree);
    const previousThreeAverage = average(previousThree);

    let direction: "up" | "down" | "steady" = "steady";
    if (lastThreeAverage !== null && previousThreeAverage !== null) {
      if (lastThreeAverage - previousThreeAverage > 0.2) {
        direction = "up";
      } else if (previousThreeAverage - lastThreeAverage > 0.2) {
        direction = "down";
      }
    }

    return {
      streak: streakCount,
      trendDirection: direction,
    };
  }, [moodLogs]);

  const trendEmoji =
    trendDirection === "up" ? "↑" : trendDirection === "down" ? "↓" : "→";

  return (
    <Card>
      <View style={styles.snapshotRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Day streak</Text>
          <Text style={styles.statValue}>
            {streak === 0 ? "Start your streak today" : `${streak}${streak >= 3 ? " 🔥" : ""}`}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>3-day trend</Text>
          <Text style={styles.statValue}>
            {trendEmoji} {trendDirection}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function MoodHeatmap() {
  const moodLogs = useAppStore((state) => state.moodLogs);

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
  const moodLogs = useAppStore((state) => state.moodLogs);
  const foodLogs = useAppStore((state) => state.foodLogs);

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
  const snapshot = useAppStore((state) => state.foodMoodSnapshot);
  const insights = useAppStore((state) => state.insights);
  const aiNarrative = useAppStore((state) => state.aiNarrative);
  const weeklyLead = insights[0]?.insightBody;

  return (
    <Card>
      <SectionTitle eyebrow="THIS WEEK" title={getWeeklySnapshotTitle(snapshot?.moodDelta)} />
      {weeklyLead ? <Text style={styles.note}>{weeklyLead}</Text> : null}
      {aiNarrative ? <Text style={styles.note}>{aiNarrative}</Text> : null}
    </Card>
  );

  const insightLead =
    insights[0]?.insightBody ??
    "Your first real Food-Mood patterns will start to show up here as you log a little more consistently.";

  return (
    <Card>
      <SectionTitle
        eyebrow="Weekly Snapshot"
        title="A gentler read on your week"
        subtitle="This is built from your actual logs over the last 30 days."
      />
      <View style={styles.snapshotRow}>
        <SnapshotStat
          label="Mood vs last week"
          value={
            snapshot?.moodDelta === null || snapshot?.moodDelta === undefined
              ? "Not enough data"
              : `${snapshot.moodDelta >= 0 ? "+" : ""}${snapshot.moodDelta}`
          }
        />
        <SnapshotStat label="Top tag" value={formatTag(snapshot?.topTag) ?? "Still forming"} />
        <SnapshotStat label="Days logged" value={`${snapshot?.daysLoggedThisWeek ?? 0} of 7`} />
      </View>
      <Text style={styles.note}>{insightLead}</Text>
      {aiNarrative ? <Text style={styles.note}>{aiNarrative}</Text> : null}
    </Card>
  );
}

export function InsightFeed() {
  const insights = useAppStore((state) => state.insights);
  const insightsLoading = useAppStore((state) => state.insightsLoading);
  const insightsError = useAppStore((state) => state.insightsError);
  const trend = useAppStore((state) => state.foodMoodTrend);

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
        const maxMetric = Math.max(...recentTrend.map((point) => getInsightMetricValue(insight.insightType, point)), 1);
        return (
          <Card key={insight.id}>
            <Text style={styles.insightTitle}>{insight.insightBody}</Text>
            {recentTrend.length ? (
              <View style={styles.chart}>
                <View style={styles.chartBars}>
                  {recentTrend.map((point, index) => (
                    <View key={`chart-col-${index}`} style={styles.chartColumn}>
                      <View
                        style={[
                          styles.metricBar,
                          {
                            height: Math.max(
                              6,
                              (getInsightMetricValue(insight.insightType, point) / maxMetric) * 30
                            ),
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
                {recentTrend.map((point, index) => (
                  <View
                    key={`chart-dot-${index}`}
                    style={[
                      styles.chartDot,
                      {
                        left: `${recentTrend.length > 1 ? (index / (recentTrend.length - 1)) * 100 : 0}%`,
                        bottom: point.moodScore ? (point.moodScore / 5) * 60 : 6,
                        backgroundColor: point.moodScore ? colors.accentPrimary : colors.border,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>A few more check-ins will give this graph something real to show.</Text>
            )}
            <Text style={styles.note}>Built from your actual food, mood, sleep, and habit logs.</Text>
          </Card>
        );
      })}
    </View>
  );

  if (insightsLoading) {
    return (
      <Card>
        <SectionTitle
          eyebrow="Food-Mood"
          title="Listening to your recent logs"
          subtitle="Pulling together your last 30 days so the patterns feel personal, not generic."
        />
      </Card>
    );
  }

  if (insightsError) {
    return (
      <Card>
        <SectionTitle
          eyebrow="Food-Mood"
          title="Your insights hit a snag"
          subtitle={insightsError}
        />
      </Card>
    );
  }

  return (
    <View style={styles.feed}>
      {insights.map((insight) => {
        const nutrientKey = getInsightTrendKey(insight.insightType);
        const maxNutrientValue = Math.max(
          ...trend.map((point) => {
            if (nutrientKey === "fiber") return point.fiber;
            if (nutrientKey === "protein") return point.protein;
            if (nutrientKey === "fermentedCount") return point.fermentedCount;
            if (nutrientKey === "sleepHours") return point.sleepHours;
            return 0;
          }),
          1
        );

        return (
          <Card key={insight.id}>
            <SectionTitle title={insight.insightBody} />
            {trend.length ? (
              <View style={styles.sparkline}>
                <View style={styles.sparklineBars}>
                  {trend.map((point, index) => {
                    const nutrientValue =
                      nutrientKey === "fiber"
                        ? point.fiber
                        : nutrientKey === "protein"
                          ? point.protein
                          : nutrientKey === "fermentedCount"
                            ? point.fermentedCount
                            : nutrientKey === "sleepHours"
                              ? point.sleepHours
                              : 0;
                    const nutrientHeight = Math.max(6, (nutrientValue / maxNutrientValue) * 28);

                    return (
                      <View key={`spark-bar-${index}`} style={styles.sparklineColumn}>
                        <View style={[styles.nutrientBar, { height: nutrientHeight }]} />
                        <Text style={styles.sparklineLabel}>{point.date.slice(5)}</Text>
                      </View>
                    );
                  })}
                </View>
                {trend.map((point, index) => {
                  const moodBottom = point.moodScore === null ? 8 : (point.moodScore / 5) * 60;
                  const left = trend.length > 1 ? `${(index / (trend.length - 1)) * 100}%` : "0%";

                  return (
                    <View
                      key={`spark-dot-${index}`}
                      style={[
                        styles.moodDot,
                        {
                          left,
                          bottom: moodBottom,
                          marginLeft: -5,
                          opacity: point.moodScore === null ? 0.35 : 1,
                          backgroundColor: point.moodScore === null ? colors.border : colors.accentPrimary,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyTrendWrap}>
                <Text style={styles.note}>A few more check-ins will give this graph something real to show.</Text>
              </View>
            )}
            <Text style={styles.note}>Built from your real mood, food, sleep, and caffeine logs.</Text>
          </Card>
        );
      })}
    </View>
  );
}

export function TrendCard() {
  return null;
  const profile = useAppStore((state) => state.profile);
  const trend = useAppStore((state) => state.foodMoodTrend);
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
  const profile = useAppStore((state) => state.profile);
  const foodLogs = useAppStore((state) => state.foodLogs);
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
  heroCard: {
    paddingVertical: 28,
    alignItems: "center",
    gap: spacing.sm,
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
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  gateFill: {
    height: "100%",
    borderRadius: 4,
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
    gap: spacing.sm,
  },
  streakNumber: {
    fontSize: 64,
    fontWeight: "800",
    color: colors.accentPrimary,
  },
  streakLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  milestoneReward: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  heroScore: {
    fontSize: 72,
    fontWeight: "700",
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
  progressRail: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  dailyRead: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  sectionWrap: {
    gap: spacing.sm,
  },
  horizontalContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  scrollCard: {
    width: 280,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  scrollCardTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  weekdayRow: {
    flexDirection: "row",
    gap: 4,
  },
  weekdayText: {
    width: 32,
    textAlign: "center",
    fontSize: 11,
    color: colors.textSecondary,
  },
  dateText: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  foodName: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  foodBarTrack: {
    width: 120,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  foodBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.accentSecondary,
  },
  foodScore: {
    width: 32,
    textAlign: "right",
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
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
  insightTitle: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  chart: {
    height: 80,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingBottom: 8,
    justifyContent: "flex-end",
    position: "relative",
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: "100%",
  },
  chartColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  metricBar: {
    width: 8,
    borderRadius: radii.round,
    backgroundColor: colors.accentSecondary,
    opacity: 0.8,
  },
  chartDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    borderWidth: 2,
    borderColor: colors.background,
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
    gap: spacing.md,
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
