import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Field, Screen } from "@/components/ui";
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
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated) {
      return;
    }

    router.replace(profile?.onboardingComplete ? "/(tabs)/log" : "/onboarding");
  }, [isAuthenticated, profile?.onboardingComplete, sessionReady]);

  if (!sessionReady) {
    return (
      <Screen>
        <View style={styles.loadingWrap} />
      </Screen>
    );
  }

  if (isAuthenticated) {
    return (
      <Screen>
        <View style={styles.loadingWrap} />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View style={styles.screenWrap}>
            <View style={styles.hero}>
              <Text style={styles.wordmark}>SavorSelf</Text>
              <Text style={styles.tagline}>FOOD · MOOD · YOU</Text>
            </View>

            <View style={styles.formWrap}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to pick up where you left off.</Text>

              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                rightAccessory={
                  <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
                    <Text style={styles.eyeIcon}>{showPassword ? "👁" : "👁‍🗨"}</Text>
                  </Pressable>
                }
              />

              {authLoading ? (
                <View style={styles.loadingButton}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.loadingButtonText}>Signing in...</Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                  onPress={async () => {
                    const result = await signIn(email.trim(), password);
                    if (!result.error) {
                      router.replace("/");
                    }
                  }}
                >
                  <Text style={styles.primaryButtonText}>Sign in</Text>
                </Pressable>
              )}

              {authError ? <Text style={styles.error}>{authError}</Text> : null}

              <Link href="/forgot-password" style={styles.forgotLink}>
                Forgot password?
              </Link>

              <Text style={styles.footerText}>
                Don&apos;t have an account?{" "}
                <Link href="/sign-up" style={styles.footerAccent}>
                  Sign up
                </Link>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
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
  forgotLink: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
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
  eyeButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  eyeIcon: {
    fontSize: 18,
  },
});
