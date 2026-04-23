import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAppStore, type AppState } from "@/store/useAppStore";

const goals = [
  "Understand my mood",
  "Improve my gut health",
  "Build better eating habits",
  "Track my nutrition",
  "Manage a health condition",
  "Just curious",
];

function GoalPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          scale.setValue(0.96);
          Animated.timing(scale, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }).start();
          onPress();
        }}
        style={({ pressed }) => [
          styles.goalPill,
          active && styles.goalPillActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.goalPillText, active && styles.goalPillTextActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const completeOnboarding = useAppStore((state: AppState) => state.completeOnboarding);
  const profile = useAppStore((state: AppState) => state.profile);
  const sessionReady = useAppStore((state: AppState) => state.sessionReady);
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [water, setWater] = useState("");
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateY = useRef(new Animated.Value(0)).current;
  const savePulse = useRef(new Animated.Value(1)).current;
  const progressOne = useRef(new Animated.Value(6)).current;
  const progressTwo = useRef(new Animated.Value(6)).current;
  const progressThree = useRef(new Animated.Value(6)).current;

  const toggleGoal = (goal: string) =>
    setSelectedGoals((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal]
    );

  useEffect(() => {
    let isMounted = true;

    if (profile?.onboardingComplete) {
      router.replace("/(tabs)/log");
      return;
    }

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.user || !isMounted) {
        return;
      }

      const { data: userRow } = await supabase
        .from("users")
        .select("onboarding_complete")
        .eq("id", session.user.id)
        .maybeSingle();

      if (isMounted && userRow?.onboarding_complete) {
        router.replace("/(tabs)/log");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [profile?.onboardingComplete]);

  useEffect(() => {
    stepOpacity.setValue(0);
    stepTranslateY.setValue(16);
    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(stepTranslateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, stepOpacity, stepTranslateY]);

  useEffect(() => {
    const values = [progressOne, progressTwo, progressThree];
    values.forEach((value, index) => {
      const activeWidth = step === index + 1 ? 20 : 6;
      Animated.timing(value, {
        toValue: activeWidth,
        duration: 180,
        useNativeDriver: false,
      }).start();
    });
  }, [progressOne, progressThree, progressTwo, step]);

  useEffect(() => {
    if (!isSaving) {
      savePulse.stopAnimation();
      savePulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(savePulse, {
          toValue: 0.7,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(savePulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [isSaving, savePulse]);

  if (!sessionReady) {
    return (
      <View style={styles.screen}>
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>Loading SavorSelf...</Text>
          <Text style={styles.centerBody}>Restoring your account and onboarding state.</Text>
        </View>
      </View>
    );
  }

  if (profile?.onboardingComplete) {
    return (
      <View style={styles.screen}>
        <View style={styles.centerState}>
          <Text style={styles.centerEyebrow}>Welcome back</Text>
          <Text style={styles.centerTitle}>Opening your log...</Text>
          <Text style={styles.centerBody}>Your account and onboarding are already in place.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step > 0 ? (
            <View style={styles.progressWrap}>
              <Animated.View style={[styles.progressDot, { width: progressOne }, step === 1 ? styles.progressDotActive : styles.progressDotInactive]} />
              <Animated.View style={[styles.progressDot, { width: progressTwo }, step === 2 ? styles.progressDotActive : styles.progressDotInactive]} />
              <Animated.View style={[styles.progressDot, { width: progressThree }, step === 3 ? styles.progressDotActive : styles.progressDotInactive]} />
            </View>
          ) : null}

          <Animated.View
            style={[
              styles.stepFrame,
              {
                opacity: stepOpacity,
                transform: [{ translateY: stepTranslateY }],
              },
            ]}
          >
            {step === 0 ? (
              <View style={styles.welcomeStep}>
                <View style={styles.welcomeCenter}>
                  <Text style={styles.wordmark}>SavorSelf</Text>
                  <Text style={styles.wordmarkTag}>FOOD · MOOD · YOU</Text>
                  <View style={styles.decorativeDots}>
                    <View style={[styles.decorativeDot, { backgroundColor: colors.accentPrimary }]} />
                    <View style={[styles.decorativeDot, { backgroundColor: colors.accentSecondary }]} />
                    <View style={[styles.decorativeDot, { backgroundColor: "#E8C9AE" }]} />
                  </View>
                </View>
                <View style={styles.stepFooter}>
                  <Pressable onPress={() => setStep(1)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>Let's begin</Text>
                  </Pressable>
                  <Text style={styles.footerHint}>A gut-brain wellness journal.</Text>
                </View>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.stepBody}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>What brings you here?</Text>
                  <Text style={styles.stepSubtitle}>Pick everything that resonates.</Text>
                </View>
                <View style={styles.goalWrap}>
                  {goals.map((goal) => (
                    <GoalPill
                      key={goal}
                      label={goal}
                      active={selectedGoals.includes(goal)}
                      onPress={() => toggleGoal(goal)}
                    />
                  ))}
                </View>
                <View style={styles.stepFooter}>
                  <Pressable onPress={() => setStep(2)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.stepBody}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>Make it yours.</Text>
                  <Text style={styles.stepSubtitle}>All optional. Change anything later.</Text>
                </View>

                <View style={styles.nameFieldWrap}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.nameInput}
                  />
                </View>

                <Text style={styles.targetsLabel}>Daily targets</Text>
                <View style={styles.targetsRow}>
                  <View style={styles.targetCard}>
                    <TextInput
                      value={calories}
                      onChangeText={setCalories}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.targetInput}
                    />
                    <Text style={styles.targetLabel}>Calories</Text>
                  </View>
                  <View style={styles.targetCard}>
                    <TextInput
                      value={protein}
                      onChangeText={setProtein}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.targetInput}
                    />
                    <Text style={styles.targetLabel}>Protein g</Text>
                  </View>
                  <View style={styles.targetCard}>
                    <TextInput
                      value={water}
                      onChangeText={setWater}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.targetInput}
                    />
                    <Text style={styles.targetLabel}>Water oz</Text>
                  </View>
                </View>

                <View style={styles.segmentedWrap}>
                  <View style={styles.segmentedControl}>
                    {(["imperial", "metric"] as const).map((option) => {
                      const active = units === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => setUnits(option)}
                          style={({ pressed }) => [
                            styles.segment,
                            active && styles.segmentActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                            {option === "imperial" ? "Imperial" : "Metric"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.stepFooter}>
                  <Pressable onPress={() => setStep(3)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {step === 3 ? (
              <View style={styles.stepBody}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>Here's how it works.</Text>
                </View>

                <View style={styles.explainerStack}>
                  <View style={styles.explainerRow}>
                    <View style={styles.explainerIconWrap}>
                      <Text style={styles.explainerIcon}>🍽️</Text>
                    </View>
                    <View style={styles.explainerCopy}>
                      <Text style={styles.explainerLabel}>Log what you eat</Text>
                      <Text style={styles.explainerDescription}>
                        Quick, conversational food logging — no calorie obsessing required.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.explainerRow}>
                    <View style={styles.explainerIconWrap}>
                      <Text style={styles.explainerIcon}>🧠</Text>
                    </View>
                    <View style={styles.explainerCopy}>
                      <Text style={styles.explainerLabel}>Track how you feel</Text>
                      <Text style={styles.explainerDescription}>
                        Mood, energy, physical and mental state — checked in daily.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.explainerRow}>
                    <View style={styles.explainerIconWrap}>
                      <Text style={styles.explainerIcon}>✨</Text>
                    </View>
                    <View style={styles.explainerCopy}>
                      <Text style={styles.explainerLabel}>Discover your patterns</Text>
                      <Text style={styles.explainerDescription}>
                        SavorSelf finds the connections between food and mood from your own data.
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.stepFooter}>
                  <Animated.View style={{ opacity: savePulse }}>
                    <Pressable
                      onPress={async () => {
                        setSaveError("");
                        setIsSaving(true);
                        const result = await completeOnboarding({
                          name: name.trim() || "",
                          preferredUnits: units,
                          dailyCalorieGoal: calories ? Number(calories) : undefined,
                          dailyProteinGoal: protein ? Number(protein) : undefined,
                          dailyWaterGoal: water ? Number(water) : undefined,
                        });
                        setIsSaving(false);

                        if (result.error) {
                          setSaveError(result.error);
                          return;
                        }

                        router.replace("/(tabs)/log");
                      }}
                      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.primaryButtonText}>{isSaving ? "Saving..." : "Start my first log"}</Text>
                    </Pressable>
                  </Animated.View>
                  {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
                  <Text style={styles.termsText}>By continuing you agree to our terms.</Text>
                </View>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  centerEyebrow: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  centerTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.textPrimary,
    textAlign: "center",
  },
  centerBody: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: "center",
  },
  progressWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 24,
  },
  progressDot: {
    height: 6,
    borderRadius: 3,
  },
  progressDotActive: {
    backgroundColor: colors.accentPrimary,
  },
  progressDotInactive: {
    backgroundColor: colors.border,
  },
  stepFrame: {
    flex: 1,
  },
  welcomeStep: {
    flex: 1,
    minHeight: 620,
  },
  welcomeCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  wordmark: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: colors.textPrimary,
  },
  wordmarkTag: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 3,
    color: colors.accentPrimary,
    textTransform: "uppercase",
    marginTop: 8,
  },
  decorativeDots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  decorativeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepBody: {
    flex: 1,
    gap: 28,
  },
  stepHeader: {
    gap: 6,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  stepSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  stepFooter: {
    marginTop: "auto",
    gap: 12,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.accentPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
  },
  footerHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  goalWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  goalPill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalPillActive: {
    backgroundColor: colors.accentPrimary,
    borderWidth: 0,
  },
  goalPillText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  goalPillTextActive: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.82,
  },
  nameFieldWrap: {
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  targetsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  targetsRow: {
    flexDirection: "row",
    gap: 10,
  },
  targetCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  targetInput: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: colors.textPrimary,
    width: "100%",
    paddingVertical: 4,
  },
  targetLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  segmentedWrap: {
    gap: 12,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F0EAE3",
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: "#2C1A0E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  explainerStack: {
    gap: 20,
  },
  explainerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  explainerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F6EDE4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentPrimary,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  explainerIcon: {
    fontSize: 24,
  },
  explainerCopy: {
    flex: 1,
    gap: 4,
  },
  explainerLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  explainerDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  errorText: {
    color: colors.accentPrimary,
    fontSize: 14,
    textAlign: "center",
  },
  termsText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
});
