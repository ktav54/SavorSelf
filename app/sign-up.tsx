import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Field, Screen } from "@/components/ui";
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
    return <Screen><View style={styles.loadingWrap} /></Screen>;
  }

  if (isAuthenticated) {
    return <Screen><View style={styles.loadingWrap} /></Screen>;
  }

  return (
    <Screen scroll>
      <View style={styles.screenWrap}>
        <View style={styles.hero}>
          <Text style={styles.wordmark}>SavorSelf</Text>
          <Text style={styles.tagline}>FOOD · MOOD · YOU</Text>
        </View>

        <View style={styles.formWrap}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Start softly and head straight into onboarding.</Text>

          <Field label="Name" value={name} onChangeText={setName} placeholder="Your first name" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="Choose a password" />

          {authLoading ? (
            <View style={styles.loadingButton}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.loadingButtonText}>Creating account...</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
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
            >
              <Text style={styles.primaryButtonText}>Create account</Text>
            </Pressable>
          )}

          {authError ? <Text style={styles.error}>{authError}</Text> : null}

          <Text style={styles.footerText}>
            Already have an account?{" "}
            <Link href="/sign-in" style={styles.footerAccent}>
              Sign in
            </Link>
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  hero: {
    alignItems: "center",
    marginBottom: 32,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: colors.accentPrimary,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 32,
  },
  formWrap: {
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  loadingButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: colors.accentPrimary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  footerText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 16,
  },
  footerAccent: {
    color: colors.accentPrimary,
    fontWeight: "600",
  },
});
