import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Card, Field, PrimaryButton, Screen, SectionTitle } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useAppStore, type AppState } from "@/store/useAppStore";

export default function SignUpScreen() {
  const signUp = useAppStore((state: AppState) => state.signUp);
  const authLoading = useAppStore((state: AppState) => state.authLoading);
  const authError = useAppStore((state: AppState) => state.authError);
  const sessionReady = useAppStore((state: AppState) => state.sessionReady);
  const isAuthenticated = useAppStore((state: AppState) => state.isAuthenticated);
  const profile = useAppStore((state: AppState) => state.profile);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!sessionReady || !isAuthenticated) {
      return;
    }

    router.replace(profile?.onboardingComplete ? "/(tabs)/log" : "/onboarding");
  }, [isAuthenticated, profile?.onboardingComplete, sessionReady]);

  if (!sessionReady) {
    return (
      <Screen>
        <SectionTitle title="Loading SavorSelf..." subtitle="Restoring your session." />
      </Screen>
    );
  }

  if (isAuthenticated) {
    return (
      <Screen>
        <SectionTitle title="Welcome back..." subtitle="Taking you to your log." />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <SectionTitle
        eyebrow="Create Account"
        title="Start softly"
        subtitle="Create your account, then we'll walk straight into onboarding."
      />
      <Card>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Your first name" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Choose a password" />
        {authLoading ? (
          <View style={styles.loadingButton}>
            <ActivityIndicator size="small" color={colors.white} />
            <Text style={styles.loadingButtonText}>Creating account...</Text>
          </View>
        ) : (
          <PrimaryButton
            label="Create account"
            onPress={async () => {
              const result = await signUp({
                name: name.trim(),
                email: email.trim(),
                password,
              });

              if (!result.error) {
                router.replace("/");
              }
            }}
          />
        )}
        {authError ? <Text style={{ color: "#C4622D", fontSize: 14 }}>{authError}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  loadingButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
