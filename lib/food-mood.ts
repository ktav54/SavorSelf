import { subDays } from "date-fns";
import type {
  FoodLog,
  FoodMoodInsight,
  FoodMoodSnapshot,
  FoodMoodTrendPoint,
  MoodLog,
  QuickLog,
} from "@/types/models";

type DailyAggregate = {
  date: string;
  moodScore: number | null;
  fiber: number;
  protein: number;
  fermentedCount: number;
  sleepHours: number;
  caffeineMg: number;
  tags: Record<string, number>;
};

function toDateKey(value: string) {
  return value.slice(0, 10);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pearsonCorrelation(xs: number[], ys: number[]) {
  if (xs.length !== ys.length || xs.length < 3) {
    return null;
  }

  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;

  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  for (let index = 0; index < xs.length; index += 1) {
    const deltaX = xs[index] - meanX;
    const deltaY = ys[index] - meanY;
    numerator += deltaX * deltaY;
    denominatorX += deltaX * deltaX;
    denominatorY += deltaY * deltaY;
  }

  const denominator = Math.sqrt(denominatorX * denominatorY);
  if (!denominator) {
    return null;
  }

  return numerator / denominator;
}

function collectDays(moodLogs: MoodLog[], foodLogs: FoodLog[], quickLogs: QuickLog[]) {
  const aggregates = new Map<string, DailyAggregate>();

  const ensureDay = (date: string) => {
    if (!aggregates.has(date)) {
      aggregates.set(date, {
        date,
        moodScore: null,
        fiber: 0,
        protein: 0,
        fermentedCount: 0,
        sleepHours: 0,
        caffeineMg: 0,
        tags: {},
      });
    }

    return aggregates.get(date)!;
  };

  moodLogs.forEach((log) => {
    const day = ensureDay(toDateKey(log.loggedAt));
    day.moodScore = log.moodScore;
  });

  foodLogs.forEach((log) => {
    const day = ensureDay(toDateKey(log.loggedAt));
    day.fiber += log.fiberG;
    day.protein += log.proteinG;
    day.fermentedCount += log.gutHealthTags.includes("fermented") || log.gutHealthTags.includes("probiotic") ? 1 : 0;
    log.gutHealthTags.forEach((tag) => {
      day.tags[tag] = (day.tags[tag] ?? 0) + 1;
    });
  });

  quickLogs.forEach((log) => {
    const day = ensureDay(toDateKey(log.loggedAt));
    day.sleepHours += log.sleepHours ?? 0;
    day.caffeineMg += log.caffeineMg ?? 0;
  });

  return Array.from(aggregates.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function makeInsight(userId: string, insightType: string, insightBody: string, supportingData: Record<string, unknown>): FoodMoodInsight {
  return {
    id: `${insightType}-${supportingData.metric ?? insightType}-${supportingData.correlation ?? Date.now()}`,
    userId,
    generatedAt: new Date().toISOString(),
    insightType,
    insightBody,
    supportingData,
    isRead: false,
  };
}

function buildCorrelationInsight(
  userId: string,
  days: DailyAggregate[],
  metric: keyof Pick<DailyAggregate, "fiber" | "protein" | "fermentedCount" | "sleepHours" | "caffeineMg">,
  positiveTemplate: (difference: number) => string,
  negativeTemplate: (difference: number) => string
) {
  const comparableDays = days.filter((day) => day.moodScore !== null);
  const xs = comparableDays.map((day) => day[metric] as number);
  const ys = comparableDays.map((day) => day.moodScore as number);
  const correlation = pearsonCorrelation(xs, ys);

  if (correlation === null || Math.abs(correlation) < 0.2) {
    return null;
  }

  const meanMetric = average(xs) ?? 0;
  const highMood = comparableDays.filter((day) => (day.moodScore ?? 0) >= 4);
  const lowMood = comparableDays.filter((day) => (day.moodScore ?? 0) <= 2);
  const highMean = average(highMood.map((day) => day[metric] as number));
  const lowMean = average(lowMood.map((day) => day[metric] as number));
  const difference = roundOne((highMean ?? meanMetric) - (lowMean ?? meanMetric));

  return makeInsight(
    userId,
    `${metric}_correlation`,
    correlation > 0 ? positiveTemplate(difference) : negativeTemplate(Math.abs(difference)),
    {
      metric,
      correlation: roundOne(correlation),
      difference,
    }
  );
}

export function analyzeFoodMood({
  userId,
  moodLogs,
  foodLogs,
  quickLogs,
}: {
  userId: string;
  moodLogs: MoodLog[];
  foodLogs: FoodLog[];
  quickLogs: QuickLog[];
}) {
  const days = collectDays(moodLogs, foodLogs, quickLogs);
  const recentDays = days.slice(-30);
  const today = new Date();
  const sevenDayKeys = Array.from({ length: 7 }).map((_, index) =>
    toDateKey(subDays(today, 6 - index).toISOString())
  );

  const byDate = new Map(recentDays.map((day) => [day.date, day]));
  const trend: FoodMoodTrendPoint[] = sevenDayKeys.map((date) => {
    const day = byDate.get(date);
    return {
      date,
      moodScore: day?.moodScore ?? null,
      fiber: Math.round(day?.fiber ?? 0),
      protein: Math.round(day?.protein ?? 0),
      fermentedCount: Math.round(day?.fermentedCount ?? 0),
      sleepHours: Math.round(day?.sleepHours ?? 0),
      caffeineMg: Math.round(day?.caffeineMg ?? 0),
    };
  });

  const thisWeek = recentDays.slice(-7);
  const lastWeek = recentDays.slice(-14, -7);
  const avgMoodThisWeek = average(thisWeek.filter((day) => day.moodScore !== null).map((day) => day.moodScore as number));
  const avgMoodLastWeek = average(lastWeek.filter((day) => day.moodScore !== null).map((day) => day.moodScore as number));

  const topTagEntry = Object.entries(
    thisWeek.reduce<Record<string, number>>((accumulator, day) => {
      Object.entries(day.tags).forEach(([tag, count]) => {
        accumulator[tag] = (accumulator[tag] ?? 0) + count;
      });
      return accumulator;
    }, {})
  ).sort((left, right) => right[1] - left[1])[0];

  const snapshot: FoodMoodSnapshot = {
    averageMoodThisWeek: avgMoodThisWeek ? roundOne(avgMoodThisWeek) : null,
    averageMoodLastWeek: avgMoodLastWeek ? roundOne(avgMoodLastWeek) : null,
    moodDelta:
      avgMoodThisWeek !== null && avgMoodLastWeek !== null
        ? roundOne(avgMoodThisWeek - avgMoodLastWeek)
        : null,
    topTag: topTagEntry?.[0] ?? null,
    daysLoggedThisWeek: thisWeek.filter((day) => day.moodScore !== null).length,
  };

  const insights = [
    buildCorrelationInsight(
      userId,
      recentDays,
      "fiber",
      (difference) => `Your higher-mood days have come with about ${Math.max(0, Math.round(difference))}g more fiber than your lower-mood days.`,
      (difference) => `On the days your mood dips, fiber tends to run about ${Math.max(0, Math.round(difference))}g lower than usual.`
    ),
    buildCorrelationInsight(
      userId,
      recentDays,
      "protein",
      (difference) => `Your mood looks steadier on days when protein lands about ${Math.max(0, Math.round(difference))}g higher.`,
      (difference) => `Protein has been lighter on lower-mood days by about ${Math.max(0, Math.round(difference))}g.`
    ),
    buildCorrelationInsight(
      userId,
      recentDays,
      "fermentedCount",
      () => "Fermented or probiotic foods show up more often on your better-mood days.",
      () => "Fermented foods have been less common across the days your mood feels lower."
    ),
    buildCorrelationInsight(
      userId,
      recentDays,
      "sleepHours",
      (difference) => `Sleep seems to matter here too. Your higher-mood days average about ${Math.max(0, difference)} more hours of sleep.`,
      (difference) => `Lower-mood days line up with roughly ${Math.max(0, difference)} fewer hours of sleep.`
    ),
    buildCorrelationInsight(
      userId,
      recentDays,
      "caffeineMg",
      () => "Caffeine has been running higher on some of your better-energy days, which may be worth keeping an eye on alongside sleep.",
      (difference) => `Higher caffeine days tend to pair with lower mood in your recent logs, by about ${Math.max(0, Math.round(difference))} mg.`
    ),
  ].filter(Boolean) as FoodMoodInsight[];

  if (!insights.length && recentDays.length) {
    insights.push(
      makeInsight(
        userId,
        "consistency",
        "You’re building enough data now that patterns are starting to form. A few more consistent check-ins will make Food-Mood sharper.",
        { metric: "consistency" }
      )
    );
  }

  return {
    insights: insights.slice(0, 5),
    snapshot,
    trend,
  };
}
