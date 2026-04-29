import { Link, router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { Card, Field, PrimaryButton, Screen, SectionTitle } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useAppStore, type AppState } from "@/store/useAppStore";

export default function SignInScreen() {
  const signIn = useAppStore((state: AppState) => state.signIn);
  const authLoading = useAppStore((state: AppState) => state.authLoading);
  const authError = useAppStore((state: AppState) => state.authError);
  const sessionReady = useAppStore((state: AppState) => state.sessionReady);
  const isAuthenticated = useAppStore((state: AppState) => state.isAuthenticated);
  const profile = useAppStore((state: AppState) => state.profile);
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
    <Screen>
      <SectionTitle
        eyebrow="Auth"
        title="Welcome back"
        subtitle="Sign in with your SavorSelf account and pick up where you left off."
      />
      <Card>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="password" />
        {authLoading ? (
          <View style={styles.loadingButton}>
            <ActivityIndicator size="small" color={colors.white} />
            <Text style={styles.loadingButtonText}>Signing in...</Text>
          </View>
        ) : (
          <PrimaryButton
            label="Sign in"
            onPress={async () => {
              const result = await signIn(email.trim(), password);
              if (!result.error) {
                router.replace("/");
              }
            }}
          />
        )}
        {authError ? <Text style={styles.error}>{authError}</Text> : null}
        <Link href="/forgot-password" style={styles.link}>
          Forgot password?
        </Link>
        <Link href="/sign-up" style={styles.link}>
          Create account
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    color: "#C4622D",
    fontSize: 15,
  },
  error: {
    color: "#C4622D",
    fontSize: 14,
  },
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
