import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";
import { PrimaryButton, Screen, SectionTitle } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const signOut = useAppStore((state) => state.signOut);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const [calorieGoal, setCalorieGoal] = useState("");
  const [proteinGoal, setProteinGoal] = useState("");
  const [carbsGoal, setCarbsGoal] = useState("");
  const [fatGoal, setFatGoal] = useState("");
  const [waterGoal, setWaterGoal] = useState("");
  const [macroStatusMessage, setMacroStatusMessage] = useState("");
  const [waterStatusMessage, setWaterStatusMessage] = useState("");
  const [savingMacros, setSavingMacros] = useState(false);
  const [savingWater, setSavingWater] = useState(false);
  const [unitControlWidth, setUnitControlWidth] = useState(0);
  const macroButtonScale = useRef(new Animated.Value(1)).current;
  const waterButtonScale = useRef(new Animated.Value(1)).current;
  const unitThumbOffset = useRef(new Animated.Value(profile?.preferredUnits === "metric" ? 1 : 0)).current;
  const waterUnitLabel = profile?.preferredUnits === "metric" ? "ml" : "oz";

  useEffect(() => {
    setCalorieGoal(profile?.dailyCalorieGoal != null ? String(profile.dailyCalorieGoal) : "");
    setProteinGoal(profile?.dailyProteinGoal != null ? String(profile.dailyProteinGoal) : "");
    setCarbsGoal(profile?.dailyCarbsGoal != null ? String(profile.dailyCarbsGoal) : "");
    setFatGoal(profile?.dailyFatGoal != null ? String(profile.dailyFatGoal) : "");
    setWaterGoal(profile?.dailyWaterGoal != null ? String(profile.dailyWaterGoal) : "");
  }, [profile?.id]);

  useEffect(() => {
    Animated.spring(unitThumbOffset, {
      toValue: profile?.preferredUnits === "metric" ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }, [profile?.preferredUnits, unitThumbOffset]);

  const handleUnitChange = async (value: "imperial" | "metric") => {
    if (!profile || profile.preferredUnits === value) {
      return;
    }

    const result = await updateProfile({ preferredUnits: value });
    setMacroStatusMessage(result.error ? result.error : `Units updated to ${value}.`);
  };

  const pulseButton = (value: Animated.Value) => {
    Animated.sequence([
      Animated.timing(value, {
        toValue: 0.96,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(value, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 180,
      }),
    ]).start();
  };

  const handleSaveGoals = async () => {
    setSavingMacros(true);
    setMacroStatusMessage("");
    pulseButton(macroButtonScale);

    const coreResult = await updateProfile({
      dailyCalorieGoal: calorieGoal.trim() ? Number(calorieGoal) : undefined,
      dailyProteinGoal: proteinGoal.trim() ? Number(proteinGoal) : undefined,
    });

    if (coreResult.error) {
      setMacroStatusMessage(coreResult.error);
      setSavingMacros(false);
      return;
    }

    const shouldSaveCarbs = carbsGoal.trim().length > 0;
    const shouldSaveFat = fatGoal.trim().length > 0;

    if (!shouldSaveCarbs && !shouldSaveFat) {
      setMacroStatusMessage("Macro goals saved.");
      setSavingMacros(false);
      return;
    }

    const extendedResult = await updateProfile({
      ...(shouldSaveCarbs ? { dailyCarbsGoal: Number(carbsGoal) } : {}),
      ...(shouldSaveFat ? { dailyFatGoal: Number(fatGoal) } : {}),
    });

    if (extendedResult.error) {
      setMacroStatusMessage(`Calories and protein saved. ${extendedResult.error}`);
      setSavingMacros(false);
      return;
    }

    setMacroStatusMessage("Macro goals saved.");
    setSavingMacros(false);
  };

  const handleSaveWaterGoal = async () => {
    setSavingWater(true);
    setWaterStatusMessage("");
    pulseButton(waterButtonScale);

    const result = await updateProfile({
      dailyWaterGoal: waterGoal.trim() ? Number(waterGoal) : undefined,
    });

    setWaterStatusMessage(result.error ? result.error : "Hydration goal saved.");
    setSavingWater(false);
  };

  const unitThumbTravel = Math.max(unitControlWidth / 2 - 6, 0);
  const unitThumbTranslateX = unitThumbOffset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, unitThumbTravel],
  });
  const waterStep = profile?.preferredUnits === "metric" ? 250 : 8;

  return (
    <Screen scroll>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.pageEyebrow}>Settings</Text>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={colors.accentPrimary} />
          </Pressable>
        </View>

        <SectionTitle
          eyebrow="Preferences"
          title="Graceful defaults, tuned to you"
          subtitle="Each setting helps the app reflect your body, your routine, and the kind of steadiness you want more of."
        />

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, styles.sectionIconSoft]}>
              <Ionicons name="swap-horizontal" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.heading}>Units</Text>
              <Text style={styles.subtext}>
                Keeping units natural to you makes hydration and nutrition cues easier to trust and act on.
              </Text>
            </View>
          </View>

          <View
            style={styles.segmentedControl}
            onLayout={(event) => setUnitControlWidth(event.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.segmentedThumb,
                {
                  width: unitControlWidth > 0 ? unitControlWidth / 2 - 6 : "50%",
                  transform: [{ translateX: unitThumbTranslateX }],
                },
              ]}
            />
            <Pressable style={styles.segmentButton} onPress={() => void handleUnitChange("imperial")}>
              <Text style={[styles.segmentText, profile?.preferredUnits === "imperial" && styles.segmentTextActive]}>Imperial</Text>
            </Pressable>
            <Pressable style={styles.segmentButton} onPress={() => void handleUnitChange("metric")}>
              <Text style={[styles.segmentText, profile?.preferredUnits === "metric" && styles.segmentTextActive]}>Metric</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, styles.sectionIconSage]}>
              <Ionicons name="leaf-outline" size={18} color={colors.accentSecondary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.heading}>Macro Goals</Text>
              <Text style={styles.subtext}>
                Gentle macro targets can support steadier blood sugar, calmer energy, and clearer mood patterns.
              </Text>
            </View>
          </View>

          <View style={styles.stepperGroup}>
            <View style={styles.stepperRow}>
              <View style={styles.stepperLabelWrap}>
                <Text style={styles.label}>Calories</Text>
                <Text style={styles.stepperHint}>per day</Text>
              </View>
              <View style={styles.stepperControl}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setCalorieGoal(String(Math.max(0, (Number(calorieGoal) || 0) - 50)))}
                >
                  <Ionicons name="remove" size={18} color={colors.textPrimary} />
                </Pressable>
                <TextInput
                  value={calorieGoal}
                  onChangeText={setCalorieGoal}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.stepperInput}
                />
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setCalorieGoal(String((Number(calorieGoal) || 0) + 50))}
                >
                  <Ionicons name="add" size={18} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <View style={styles.stepperLabelWrap}>
                <Text style={styles.label}>Protein</Text>
                <Text style={styles.stepperHint}>grams</Text>
              </View>
              <View style={styles.stepperControl}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setProteinGoal(String(Math.max(0, (Number(proteinGoal) || 0) - 5)))}
                >
                  <Ionicons name="remove" size={18} color={colors.textPrimary} />
                </Pressable>
                <TextInput
                  value={proteinGoal}
                  onChangeText={setProteinGoal}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.stepperInput}
                />
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setProteinGoal(String((Number(proteinGoal) || 0) + 5))}
                >
                  <Ionicons name="add" size={18} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <View style={styles.stepperLabelWrap}>
                <Text style={styles.label}>Carbs</Text>
                <Text style={styles.stepperHint}>grams</Text>
              </View>
              <View style={styles.stepperControl}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setCarbsGoal(String(Math.max(0, (Number(carbsGoal) || 0) - 5)))}
                >
                  <Ionicons name="remove" size={18} color={colors.textPrimary} />
                </Pressable>
                <TextInput
                  value={carbsGoal}
                  onChangeText={setCarbsGoal}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.stepperInput}
                />
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setCarbsGoal(String((Number(carbsGoal) || 0) + 5))}
                >
                  <Ionicons name="add" size={18} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <View style={styles.stepperLabelWrap}>
                <Text style={styles.label}>Fat</Text>
                <Text style={styles.stepperHint}>grams</Text>
              </View>
              <View style={styles.stepperControl}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setFatGoal(String(Math.max(0, (Number(fatGoal) || 0) - 5)))}
                >
                  <Ionicons name="remove" size={18} color={colors.textPrimary} />
                </Pressable>
                <TextInput
                  value={fatGoal}
                  onChangeText={setFatGoal}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.stepperInput}
                />
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setFatGoal(String((Number(fatGoal) || 0) + 5))}
                >
                  <Ionicons name="add" size={18} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          </View>

          <Animated.View style={[styles.buttonWrap, { transform: [{ scale: macroButtonScale }] }]}>
            <PrimaryButton label={savingMacros ? "Saving..." : "Save Goals"} onPress={() => void handleSaveGoals()} />
          </Animated.View>
          {macroStatusMessage ? <Text style={styles.status}>{macroStatusMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, styles.sectionIconWater]}>
              <Ionicons name="water-outline" size={18} color={colors.blue} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.heading}>Hydration</Text>
              <Text style={styles.subtext}>
                Hydration quietly shapes digestion, focus, and how settled your nervous system feels through the day.
              </Text>
            </View>
          </View>

          <View style={styles.hydrationHero}>
            <Text style={styles.hydrationValue}>{waterGoal || "0"}</Text>
            <Text style={styles.hydrationUnit}>{waterUnitLabel} daily target</Text>
          </View>

          <View style={styles.stepperRow}>
            <View style={styles.stepperLabelWrap}>
              <Text style={styles.label}>Water Goal</Text>
              <Text style={styles.stepperHint}>in {waterUnitLabel}</Text>
            </View>
            <View style={styles.stepperControl}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setWaterGoal(String(Math.max(0, (Number(waterGoal) || 0) - waterStep)))}
              >
                <Ionicons name="remove" size={18} color={colors.textPrimary} />
              </Pressable>
              <TextInput
                value={waterGoal}
                onChangeText={setWaterGoal}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={styles.stepperInput}
              />
              <Pressable
                style={styles.stepperButton}
                onPress={() => setWaterGoal(String((Number(waterGoal) || 0) + waterStep))}
              >
                <Ionicons name="add" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.helper}>Small daily consistency here tends to support better digestion and steadier energy.</Text>

          <Animated.View style={[styles.buttonWrap, { transform: [{ scale: waterButtonScale }] }]}>
            <PrimaryButton
              label={savingWater ? "Saving..." : "Save Water Goal"}
              onPress={() => void handleSaveWaterGoal()}
              secondary
            />
          </Animated.View>
          {waterStatusMessage ? <Text style={styles.status}>{waterStatusMessage}</Text> : null}
        </View>

        <View style={[styles.card, styles.proCard]}>
          <View style={styles.proGlowOne} />
          <View style={styles.proGlowTwo} />
          <View style={styles.proTopRow}>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
            <Text style={styles.proTier}>Tier: {profile?.subscriptionTier ?? "free"}</Text>
          </View>
          <Text style={styles.proTitle}>Subscription</Text>
          <Text style={styles.proBody}>
            Premium space for deeper insights, richer reports, and a more tailored gut-brain experience.
          </Text>
          <View style={styles.proPlaceholder}>
            <Ionicons name="sparkles-outline" size={16} color={colors.accentPrimary} />
            <Text style={styles.proPlaceholderText}>RevenueCat can plug in here when monetization turns on.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, styles.sectionIconNotification]}>
              <Ionicons name="notifications-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.heading}>Notifications</Text>
              <Text style={styles.subtext}>
                Gentle reminders work best when they feel supportive, not demanding, especially for habit-building and mood tracking.
              </Text>
            </View>
          </View>

          <View style={styles.notificationRow}>
            <View>
              <Text style={styles.notificationTitle}>Daily morning check-in</Text>
              <Text style={styles.notificationText}>A soft reset to notice mood, meals, and how your body is landing today.</Text>
            </View>
            <View style={styles.notificationPill}>
              <Text style={styles.notificationPillText}>Soon</Text>
            </View>
          </View>

          <View style={styles.notificationRow}>
            <View>
              <Text style={styles.notificationTitle}>Two-day lapse nudge</Text>
              <Text style={styles.notificationText}>A warm re-entry cue when logging has gone quiet for a couple of days.</Text>
            </View>
            <View style={styles.notificationPill}>
              <Text style={styles.notificationPillText}>Soon</Text>
            </View>
          </View>

          <View style={[styles.notificationRow, styles.notificationRowLast]}>
            <View>
              <Text style={styles.notificationTitle}>Weekly Food-Mood report</Text>
              <Text style={styles.notificationText}>A calmer end-of-week glance at what is starting to connect in your patterns.</Text>
            </View>
            <View style={styles.notificationPill}>
              <Text style={styles.notificationPillText}>Soon</Text>
            </View>
          </View>
        </View>

        <View style={styles.signOutWrap}>
          <PrimaryButton label="Sign out" secondary onPress={() => void signOut()} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.xs,
  },
  pageEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3EDE7",
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2C1A0E",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  closeText: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: "#2C1A0E",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  sectionIconSoft: {
    backgroundColor: "#F8ECE2",
  },
  sectionIconSage: {
    backgroundColor: "#ECF2EA",
  },
  sectionIconWater: {
    backgroundColor: "#EAF2F9",
  },
  sectionIconNotification: {
    backgroundColor: "#F8ECE2",
  },
  sectionCopy: {
    flex: 1,
    gap: 6,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: "700",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  segmentedControl: {
    position: "relative",
    flexDirection: "row",
    backgroundColor: "#F2EDE6",
    borderRadius: 20,
    padding: 3,
    overflow: "hidden",
  },
  segmentedThumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 17,
    backgroundColor: "#FDFBF8",
    shadowColor: "#2C1A0E",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    zIndex: 1,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.textPrimary,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  stepperGroup: {
    gap: spacing.sm,
  },
  stepperRow: {
    backgroundColor: "#F7F2EB",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  stepperLabelWrap: {
    gap: 4,
    flex: 1,
  },
  stepperHint: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  stepperControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 6,
    minWidth: 170,
    justifyContent: "space-between",
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2EDE6",
  },
  stepperInput: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  buttonWrap: {
    marginTop: spacing.xs,
  },
  hydrationHero: {
    backgroundColor: "#EEF4F8",
    borderRadius: 22,
    padding: spacing.lg,
    alignItems: "center",
    gap: 4,
  },
  hydrationValue: {
    color: colors.textPrimary,
    fontSize: 38,
    fontWeight: "800",
  },
  hydrationUnit: {
    color: colors.textSecondary,
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  status: {
    color: colors.accentPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  proCard: {
    overflow: "hidden",
    backgroundColor: "#FFF6EE",
  },
  proGlowOne: {
    position: "absolute",
    top: -30,
    right: -10,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(196, 98, 45, 0.16)",
  },
  proGlowTwo: {
    position: "absolute",
    bottom: -46,
    left: -20,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(138, 158, 123, 0.14)",
  },
  proTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  proBadge: {
    backgroundColor: colors.textPrimary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  proBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  proTier: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  proTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  proBody: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: "88%",
  },
  proPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.68)",
    borderRadius: 18,
    padding: spacing.md,
  },
  proPlaceholderText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  notificationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(44, 26, 14, 0.06)",
  },
  notificationRowLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  notificationTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  notificationText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 240,
  },
  notificationPill: {
    backgroundColor: "#ECF2EA",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  notificationPillText: {
    color: colors.accentSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  signOutWrap: {
    marginTop: spacing.xs,
  },
});
