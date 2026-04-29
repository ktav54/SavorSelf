import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAppStore, type AppState } from "@/store/useAppStore";

const questionCards = [
  {
    value: "Understand my mood",
    title: "🧠 Understand my mood",
    subtitle: "Connect what I eat to how I feel",
  },
  {
    value: "More energy",
    title: "⚡ More energy",
    subtitle: "Find what actually fuels me",
  },
  {
    value: "Eat more intentionally",
    title: "🌿 Eat more intentionally",
    subtitle: "Build a healthier relationship with food",
  },
  {
    value: "Track my patterns",
    title: "📊 Track my patterns",
    subtitle: "See real data about my gut-brain connection",
  },
] as const;

const challengeCards = [
  "😵 I forget to track",
  "🍕 Emotional eating",
  "😴 Low energy crashes",
  "🌀 Inconsistent moods",
] as const;

const calorieOptions = [
  { label: "Under 1800", value: 1600 },
  { label: "1800–2200", value: 2000 },
  { label: "2200+", value: 2400 },
] as const;

function QuestionCard({
  title,
  subtitle,
  selected,
  onPress,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.questionCard,
        compact && styles.questionCardCompact,
        selected && styles.questionCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.questionCardTitle, selected && styles.questionCardTitleSelected]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.questionCardSubtitle, selected && styles.questionCardSubtitleSelected]}>{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const completeOnboarding = useAppStore((state: AppState) => state.completeOnboarding);
  const profile = useAppStore((state: AppState) => state.profile);
  const sessionReady = useAppStore((state: AppState) => state.sessionReady);
  const [step, setStep] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [userName, setUserName] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [challenge, setChallenge] = useState("");
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [allowExplainerAfterSetup, setAllowExplainerAfterSetup] = useState(false);

  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateY = useRef(new Animated.Value(0)).current;
  const questionDots = useRef(Array.from({ length: 5 }, () => new Animated.Value(6))).current;
  const bridgeScale = useRef(new Animated.Value(0.8)).current;
  const displayName = userName.trim() || profile?.name?.trim() || "friend";

  useEffect(() => {
    let isMounted = true;

    if (profile?.onboardingComplete && !allowExplainerAfterSetup) {
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

      if (isMounted && userRow?.onboarding_complete && !allowExplainerAfterSetup) {
        router.replace("/(tabs)/log");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [allowExplainerAfterSetup, profile?.onboardingComplete]);

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
  }, [questionIndex, step, stepOpacity, stepTranslateY]);

  useEffect(() => {
    if (step !== 1) {
      return;
    }

    questionDots.forEach((value, index) => {
      Animated.timing(value, {
        toValue: index === questionIndex ? 20 : 6,
        duration: 180,
        useNativeDriver: false,
      }).start();
    });
  }, [questionDots, questionIndex, step]);

  useEffect(() => {
    if (step !== 4) {
      return;
    }

    bridgeScale.setValue(0.8);
    Animated.spring(bridgeScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => {
      router.replace("/(tabs)/log");
    }, 2500);

    return () => clearTimeout(timeout);
  }, [bridgeScale, step]);

  const advanceQuestion = (nextIndex: number) => {
    setTimeout(() => {
      setQuestionIndex(nextIndex);
    }, 300);
  };

  const finishQuestionnaire = async () => {
    setSaveError("");
    setIsSaving(true);
    setAllowExplainerAfterSetup(true);

    const startedAt = Date.now();
    const result = await completeOnboarding({
      name: userName.trim() || "",
      preferredUnits: units,
      dailyCalorieGoal: calorieGoal,
      onboardingGoal: primaryGoal,
      onboardingChallenge: challenge,
      ...(primaryGoal ? ({ goals: [primaryGoal] } as any) : {}),
    } as any);
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 1000 - elapsed);

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    if (result.error) {
      setIsSaving(false);
      setSaveError(result.error);
      setAllowExplainerAfterSetup(false);
      return;
    }

    setIsSaving(false);
    setStep(2);
  };

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

  if (profile?.onboardingComplete && !allowExplainerAfterSetup) {
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            <View style={styles.progressWrap}>
              {questionDots.map((dot, index) => (
                <Animated.View
                  key={`question-dot-${index}`}
                  style={[
                    styles.progressDot,
                    { width: dot },
                    index === questionIndex ? styles.progressDotActive : styles.progressDotInactive,
                  ]}
                />
              ))}
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
                  <Pressable
                    onPress={() => {
                      setStep(1);
                      setQuestionIndex(0);
                    }}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.primaryButtonText}>Let's begin</Text>
                  </Pressable>
                  <Text style={styles.footerHint}>A gut-brain wellness journal.</Text>
                </View>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.stepBody}>
                <View style={styles.questionTopMeta}>
                  {questionIndex > 0 ? (
                    <Pressable onPress={() => setQuestionIndex((current) => Math.max(0, current - 1))} style={({ pressed }) => [styles.backLinkWrap, pressed && styles.pressed]}>
                      <Text style={styles.backLink}>←</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.backLinkSpacer} />
                  )}
                  <Text style={styles.questionProgressText}>Question {questionIndex + 1} of 5</Text>
                  <View style={styles.backLinkSpacer} />
                </View>

                {isSaving ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator size="small" color={colors.accentPrimary} />
                    <Text style={styles.loadingTitle}>Setting up your profile...</Text>
                    <Text style={styles.loadingBody}>A softer start is coming together.</Text>
                  </View>
                ) : null}

                {!isSaving && questionIndex === 0 ? (
                  <View style={styles.questionBody}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.stepTitle}>What should I call you?</Text>
                    </View>
                    <View style={styles.nameFieldWrap}>
                      <TextInput
                        value={userName}
                        onChangeText={setUserName}
                        placeholder="Your first name"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.nameInput}
                        textAlign="center"
                      />
                    </View>
                    <View style={styles.stepFooter}>
                      <Pressable onPress={() => setQuestionIndex(1)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                        <Text style={styles.primaryButtonText}>That's me →</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {!isSaving && questionIndex === 1 ? (
                  <View style={styles.questionBody}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.stepTitle}>What brings you to SavorSelf?</Text>
                    </View>
                    <View style={styles.cardStack}>
                      {[
                        {
                          emoji: "😤",
                          title: "I feel like crap and don't know why",
                          subtitle: "Low energy, mood swings, brain fog — let's find the pattern",
                          value: "feel_better",
                        },
                        {
                          emoji: "🔗",
                          title: "I want to understand my body better",
                          subtitle: "Connect the dots between food, mood, and how I actually feel",
                          value: "understand_body",
                        },
                        {
                          emoji: "🌱",
                          title: "I want a healthier relationship with food",
                          subtitle: "No obsessing, no guilt — just awareness and intention",
                          value: "healthy_relationship",
                        },
                        {
                          emoji: "📈",
                          title: "I want to optimize my performance",
                          subtitle: "Use nutrition data to fuel better focus, energy, and mood",
                          value: "optimize",
                        },
                      ].map((option) => (
                        <Pressable
                          key={option.value}
                          style={({ pressed }) => [
                            styles.goalCard,
                            primaryGoal === option.value && styles.goalCardSelected,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => {
                            setPrimaryGoal(option.value);
                            advanceQuestion(2);
                          }}
                        >
                          <Text style={styles.goalCardEmoji}>{option.emoji}</Text>
                          <View style={styles.goalCardText}>
                            <Text style={styles.goalCardTitle}>{option.title}</Text>
                            <Text style={styles.goalCardSubtitle}>{option.subtitle}</Text>
                          </View>
                          {primaryGoal === option.value ? <Text style={styles.goalCardCheck}>✓</Text> : null}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {!isSaving && questionIndex === 2 ? (
                  <View style={styles.questionBody}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.stepTitle}>What gets in the way most?</Text>
                    </View>
                    <View style={styles.cardStack}>
                      {challengeCards.map((option) => (
                        <QuestionCard
                          key={option}
                          title={option}
                          selected={challenge === option}
                          onPress={() => {
                            setChallenge(option);
                            advanceQuestion(3);
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {!isSaving && questionIndex === 3 ? (
                  <View style={styles.questionBody}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.stepTitle}>What's your rough daily calorie target?</Text>
                    </View>
                    <View style={styles.calorieRow}>
                      {calorieOptions.map((option) => (
                        <QuestionCard
                          key={option.label}
                          title={option.label}
                          compact
                          selected={calorieGoal === option.value}
                          onPress={() => {
                            setCalorieGoal(option.value);
                            advanceQuestion(4);
                          }}
                        />
                      ))}
                    </View>
                    <Pressable
                      onPress={() => {
                        setCalorieGoal(2000);
                        advanceQuestion(4);
                      }}
                      style={({ pressed }) => [styles.laterLinkWrap, pressed && styles.pressed]}
                    >
                      <Text style={styles.laterLink}>I'll set this later</Text>
                    </Pressable>
                  </View>
                ) : null}

                {!isSaving && questionIndex === 4 ? (
                  <View style={styles.questionBody}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.stepTitle}>Imperial or metric?</Text>
                    </View>
                    <View style={styles.unitsRow}>
                      <QuestionCard
                        title="🇺🇸 Imperial"
                        subtitle="lbs, oz, °F"
                        selected={units === "imperial"}
                        onPress={() => {
                          setUnits("imperial");
                          void finishQuestionnaire();
                        }}
                      />
                      <QuestionCard
                        title="🌍 Metric"
                        subtitle="kg, ml, °C"
                        selected={units === "metric"}
                        onPress={() => {
                          setUnits("metric");
                          void finishQuestionnaire();
                        }}
                      />
                    </View>
                    {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {step === 2 ? (
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
                  <Pressable onPress={() => setStep(4)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>Start my first log</Text>
                  </Pressable>
                  {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
                  <Text style={styles.termsText}>By continuing you agree to our terms.</Text>
                </View>
              </View>
            ) : null}

            {step === 4 ? (
              <View style={styles.bridgeScreen}>
                <Animated.Text style={[styles.bridgeEmoji, { transform: [{ scale: bridgeScale }] }]}>🌱</Animated.Text>
                <Text style={styles.bridgeTitle}>You're all set, {displayName}!</Text>
                <Text style={styles.bridgeSub}>
                  Your gut-brain journal is ready.{"\n"}
                  Start by logging how you feel today.
                </Text>
                <View style={styles.bridgeDots}>
                  <ActivityIndicator color={colors.accentPrimary} />
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
    gap: 24,
  },
  questionBody: {
    flex: 1,
    gap: 24,
  },
  questionTopMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
  },
  questionProgressText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  backLinkWrap: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backLinkSpacer: {
    width: 28,
  },
  backLink: {
    fontSize: 20,
    color: colors.accentPrimary,
    fontWeight: "500",
  },
  stepHeader: {
    gap: 6,
  },
  questionHeader: {
    gap: 6,
    alignItems: "center",
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.textPrimary,
    textAlign: "center",
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
  cardStack: {
    gap: 12,
  },
  goalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  goalCardSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: "#FFF8F4",
  },
  goalCardEmoji: {
    fontSize: 28,
  },
  goalCardText: {
    flex: 1,
  },
  goalCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 3,
  },
  goalCardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  goalCardCheck: {
    fontSize: 16,
    color: colors.accentPrimary,
    fontWeight: "700",
  },
  questionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  questionCardCompact: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: "center",
  },
  questionCardSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: "#FFF8F4",
  },
  questionCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  questionCardTitleSelected: {
    color: colors.textPrimary,
  },
  questionCardSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  questionCardSubtitleSelected: {
    color: colors.textSecondary,
  },
  calorieRow: {
    flexDirection: "row",
    gap: 10,
  },
  unitsRow: {
    flexDirection: "row",
    gap: 12,
  },
  laterLinkWrap: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  laterLink: {
    fontSize: 14,
    color: colors.accentPrimary,
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.textPrimary,
    textAlign: "center",
  },
  loadingBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
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
  bridgeScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  bridgeEmoji: {
    fontSize: 72,
    marginBottom: 24,
  },
  bridgeTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  bridgeSub: {
    fontSize: 17,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 32,
  },
  bridgeDots: {
    marginTop: 8,
  },
});
