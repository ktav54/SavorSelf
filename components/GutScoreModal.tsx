import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radii, spacing } from "@/constants/theme";

export type GutScoreData = {
  foodName: string;
  score: number;
  summary: string;
  tags: Array<{ label: string; tone: "green" | "amber" }>;
  insights: Array<{ category: string; body: string }>;
};

const CATEGORY_META: Record<string, { bg: string; tint: string; label: string; border: string }> = {
  Energy:    { bg: `${colors.accentSecondary}18`, tint: colors.accentSecondary, label: "E", border: `${colors.accentSecondary}55` },
  Mood:      { bg: `${colors.accentPrimary}14`,   tint: colors.accentPrimary,   label: "M", border: `${colors.accentPrimary}55` },
  Digestion: { bg: `${colors.accentTertiary}18`,  tint: "#9A7420",              label: "D", border: `${colors.accentTertiary}55` },
};

const TAG_COLORS = {
  green: { bg: "#E3F5EC", text: "#147A55", border: `${colors.accentSecondary}55` },
  amber: { bg: "#FCE9C9", text: "#9A5A00", border: `${colors.accentPrimary}55` },
} as const;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const safEnd = Math.min(endDeg, startDeg + 359.99);
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, safEnd);
  const large = safEnd - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function ScoreRing({ score }: { score: number }) {
  const SIZE = 80;
  const STROKE = 8;
  const R = 32;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const START_DEG = 135;
  const SWEEP_DEG = 270;
  const fillColor = score >= 70 ? colors.accentSecondary : score >= 45 ? colors.accentPrimary : "#C97B6C";

  return (
    <View style={styles.ringWrap}>
      <Svg width={SIZE} height={SIZE}>
        <Path
          d={arcPath(CX, CY, R, START_DEG, START_DEG + SWEEP_DEG)}
          fill="none"
          stroke={`${colors.border}`}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <Path
          d={arcPath(CX, CY, R, START_DEG, START_DEG + (score / 100) * SWEEP_DEG)}
          fill="none"
          stroke={fillColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringScore, { color: fillColor }]}>{score}</Text>
        <Text style={styles.ringDenominator}>/100</Text>
      </View>
    </View>
  );
}

export function GutScoreModal({
  visible,
  data,
  onClose,
}: {
  visible: boolean;
  data: GutScoreData | null;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {data ? (
              <>
                <Text style={styles.eyebrow}>Gut Score</Text>
                <Text style={styles.title}>{data.foodName}</Text>

                <View style={styles.heroRow}>
                  <ScoreRing score={data.score} />
                  <View style={styles.heroCopy}>
                    <View style={styles.tagRow}>
                      {data.tags.map((tag, index) => {
                        const c = tag.tone === "green" ? TAG_COLORS.green : TAG_COLORS.amber;
                        return (
                          <View key={index} style={[styles.tag, { backgroundColor: c.bg, borderColor: c.border }]}>
                            <Text style={[styles.tagText, { color: c.text }]}>{tag.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.summary}>{data.summary}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.sectionList}>
                  {data.insights.map((item) => {
                    const meta = CATEGORY_META[item.category] ?? CATEGORY_META.Energy;
                    return (
                      <View key={item.category} style={styles.sectionRow}>
                        <View style={[styles.iconBox, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                          <Text style={[styles.iconText, { color: meta.tint }]}>{meta.label}</Text>
                        </View>
                        <View style={styles.sectionCopy}>
                          <Text style={styles.insightCategory}>{item.category}</Text>
                          <Text style={styles.sectionBody}>{item.body}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(30, 20, 12, 0.38)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "88%",
    paddingTop: spacing.lg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "600",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  ringWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
  },
  ringScore: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 26,
  },
  ringDenominator: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 13,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm,
    paddingTop: 4,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.round,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  summary: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  sectionList: {
    gap: spacing.md,
  },
  sectionRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  iconText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sectionCopy: {
    flex: 1,
    gap: 3,
  },
  insightCategory: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
  sectionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  closeBtn: {
    margin: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
});
