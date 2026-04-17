import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { Card, Chip, Field, PrimaryButton, Screen, SectionTitle } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";

const goals = [
  "Understand my mood",
  "Improve my gut health",
  "Build better eating habits",
  "Track my nutrition",
  "Manage a health condition",
  "Just curious",
];

export default function OnboardingScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const profile = useAppStore((state) => state.profile);
  const sessionReady = useAppStore((state) => state.sessionReady);
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [water, setWater] = useState("");
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  if (!sessionReady) {
    return (
      <Screen>
        <Card>
          <SectionTitle
            eyebrow="Loading"
            title="Loading SavorSelf..."
            subtitle="Restoring your account and onboarding state."
          />
        </Card>
      </Screen>
    );
  }

  if (profile?.onboardingComplete) {
    return (
      <Screen>
        <Card>
          <SectionTitle
            eyebrow="Welcome back"
            title="Opening your log..."
            subtitle="Your account and onboarding are already in place."
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {step === 0 ? (
        <Card>
          <SectionTitle
            eyebrow="Welcome"
            title="SavorSelf"
            subtitle="Your gut and brain are in constant conversation. SavorSelf listens."
          />
          <PrimaryButton label="Let's begin" onPress={() => setStep(1)} />
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <SectionTitle
            eyebrow="Goals"
            title="What brings you to SavorSelf?"
            subtitle="There are no wrong answers here."
          />
          <View style={styles.wrap}>
            {goals.map((goal) => (
              <Chip
                key={goal}
                label={goal}
                active={selectedGoals.includes(goal)}
                onPress={() => toggleGoal(goal)}
              />
            ))}
          </View>
          <PrimaryButton label="Continue" onPress={() => setStep(2)} />
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <SectionTitle
            eyebrow="Setup"
            title="A few details to make this feel personal"
            subtitle="Goals are optional. Units can always change later."
          />
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your first name" />
          <Field label="Daily calorie goal" value={calories} onChangeText={setCalories} placeholder="Optional" />
          <Field label="Protein goal" value={protein} onChangeText={setProtein} placeholder="Optional" />
          <Field label="Water goal" value={water} onChangeText={setWater} placeholder="Optional" />
          <View style={styles.wrap}>
            <Chip label="Imperial" active={units === "imperial"} onPress={() => setUnits("imperial")} />
            <Chip label="Metric" active={units === "metric"} onPress={() => setUnits("metric")} />
          </View>
          <PrimaryButton label="Continue" onPress={() => setStep(3)} />
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <SectionTitle
            eyebrow="Food-Mood"
            title="Your gut and brain are in constant conversation."
            subtitle="The vagus nerve helps carry signals both ways. Over time, your logs become a personal pattern engine."
          />
          <View style={styles.animationStub}>
            <Text style={styles.stubText}>Animated explainer placeholder</Text>
          </View>
          <PrimaryButton
            label={isSaving ? "Saving..." : "Start my first log"}
            onPress={async () => {
              setSaveError("");
              setIsSaving(true);
              const result = await completeOnboarding({
                name: name || "Avery",
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
          />
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  animationStub: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6E8D8",
    borderRadius: 16,
  },
  stubText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  errorText: {
    color: colors.accentPrimary,
    fontSize: 14,
  },
});
