import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { Card, Chip, PrimaryButton, Screen, SectionTitle } from "@/components/ui";
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
  const macroButtonScale = useRef(new Animated.Value(1)).current;
  const waterButtonScale = useRef(new Animated.Value(1)).current;
  const waterUnitLabel = profile?.preferredUnits === "metric" ? "ml" : "oz";

  useEffect(() => {
    setCalorieGoal(profile?.dailyCalorieGoal != null ? String(profile.dailyCalorieGoal) : "");
    setProteinGoal(profile?.dailyProteinGoal != null ? String(profile.dailyProteinGoal) : "");
    setCarbsGoal(profile?.dailyCarbsGoal != null ? String(profile.dailyCarbsGoal) : "");
    setFatGoal(profile?.dailyFatGoal != null ? String(profile.dailyFatGoal) : "");
    setWaterGoal(profile?.dailyWaterGoal != null ? String(profile.dailyWaterGoal) : "");
  }, [profile?.id]);

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

  return (
    <Screen scroll>
      <View style={styles.topBar}>
        <View />
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>X</Text>
        </Pressable>
      </View>
      <SectionTitle
        eyebrow="Settings"
        title="Preferences, goals, and account"
        subtitle="Units, notification timing, premium state, and account actions all have a home here."
      />
      <Card>
        <Text style={styles.heading}>Units</Text>
        <View style={styles.row}>
          <Chip label="Imperial" active={profile?.preferredUnits === "imperial"} onPress={() => void handleUnitChange("imperial")} />
          <Chip label="Metric" active={profile?.preferredUnits === "metric"} onPress={() => void handleUnitChange("metric")} />
        </View>
      </Card>
      <Card>
        <Text style={styles.heading}>Macro Goals</Text>
        <Text style={styles.body}>Keep the main focus on the macro targets you actually want to steer by.</Text>
        <Text style={styles.label}>Calories</Text>
        <TextInput
          value={calorieGoal}
          onChangeText={setCalorieGoal}
          keyboardType="numeric"
          placeholder="Daily calorie goal"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Text style={styles.label}>Protein</Text>
        <TextInput
          value={proteinGoal}
          onChangeText={setProteinGoal}
          keyboardType="numeric"
          placeholder="Daily protein goal"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Text style={styles.label}>Carbs</Text>
        <TextInput
          value={carbsGoal}
          onChangeText={setCarbsGoal}
          keyboardType="numeric"
          placeholder="Daily carbs goal"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Text style={styles.label}>Fat</Text>
        <TextInput
          value={fatGoal}
          onChangeText={setFatGoal}
          keyboardType="numeric"
          placeholder="Daily fat goal"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Animated.View style={{ transform: [{ scale: macroButtonScale }] }}>
          <PrimaryButton label={savingMacros ? "Saving..." : "Save Goals"} onPress={() => void handleSaveGoals()} />
        </Animated.View>
        {macroStatusMessage ? <Text style={styles.status}>{macroStatusMessage}</Text> : null}
      </Card>
      <Card>
        <Text style={styles.heading}>Hydration</Text>
        <Text style={styles.body}>Keep water in its own lane here.</Text>
        <Text style={styles.label}>Water ({waterUnitLabel})</Text>
        <TextInput
          value={waterGoal}
          onChangeText={setWaterGoal}
          keyboardType="numeric"
          placeholder={`Daily water goal in ${waterUnitLabel}`}
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Text style={styles.helper}>Enter the amount you want to aim for each day in {waterUnitLabel}.</Text>
        <Animated.View style={{ transform: [{ scale: waterButtonScale }] }}>
          <PrimaryButton label={savingWater ? "Saving..." : "Save Water Goal"} onPress={() => void handleSaveWaterGoal()} secondary />
        </Animated.View>
        {waterStatusMessage ? <Text style={styles.status}>{waterStatusMessage}</Text> : null}
      </Card>
      <Card>
        <Text style={styles.heading}>Subscription</Text>
        <Text style={styles.body}>Tier: {profile?.subscriptionTier ?? "free"}</Text>
        <Text style={styles.body}>RevenueCat can plug in here when monetization turns on.</Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.body}>Daily morning check-in</Text>
        <Text style={styles.body}>Two-day lapse nudge</Text>
        <Text style={styles.body}>Weekly Food-Mood report</Text>
      </Card>
      <PrimaryButton label="Sign out" secondary onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F6DFC9",
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  closeText: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.1)",
    borderRadius: 14,
    backgroundColor: colors.white,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  status: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
