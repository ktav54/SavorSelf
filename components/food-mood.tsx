import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Chip, SectionTitle } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { featureFlags } from "@/lib/premium";

export function WeeklySnapshot() {
  const snapshot = useAppStore((state) => state.foodMoodSnapshot);
  const insights = useAppStore((state) => state.insights);
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
    </Card>
  );
}

export function InsightFeed() {
  const insights = useAppStore((state) => state.insights);
  const insightsLoading = useAppStore((state) => state.insightsLoading);
  const insightsError = useAppStore((state) => state.insightsError);

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
        const chartValues = insight.supportingData.difference
          ? [2, Number(insight.supportingData.difference) + 2, 3, Number(insight.supportingData.difference) + 1]
          : [2, 4, 3, 5];

        return (
          <Card key={insight.id}>
            <SectionTitle title={insight.insightBody} />
            <View style={styles.chartStub}>
              {chartValues.map((value, index) => (
                <View
                  key={`${insight.id}-${index}`}
                  style={[
                    styles.chartBar,
                    {
                      height: 14 + value * 10,
                      backgroundColor: index % 2 === 0 ? colors.accentPrimary : colors.accentSecondary,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.note}>Built from your real mood, food, sleep, and caffeine logs.</Text>
          </Card>
        );
      })}
    </View>
  );
}

export function TrendCard() {
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
                <View key={point.date} style={styles.trendColumn}>
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

const styles = StyleSheet.create({
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
  chartStub: {
    height: 76,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  chartBar: {
    width: 28,
    borderRadius: 8,
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
