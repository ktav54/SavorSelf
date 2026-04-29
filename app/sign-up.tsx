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
import { supabase } from "@/lib/supabase";
import { useAppStore, type AppState } from "@/store/useAppStore";

const getPasswordStrength = (pwd: string): { label: string; color: string; width: `${number}%` } => {
  if (pwd.length === 0) {
    return { label: "", color: "transparent", width: "0%" };
  }
  if (pwd.length < 6) {
    return { label: "Too short", color: "#E57373", width: "25%" };
  }
  if (pwd.length < 8) {
    return { label: "Weak", color: "#FFB74D", width: "50%" };
  }
  if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return { label: "Fair", color: "#FFD54F", width: "75%" };
  }
  return { label: "Strong", color: "#81C784", width: "100%" };
};

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
  const [error, setError] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");

  const strength = getPasswordStrength(password);

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

  const resendVerification = async () => {
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });

    if (resendError) {
      setVerificationMessage(resendError.message);
      return;
    }

    setVerificationMessage("Verification email resent.");
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          {showVerification ? (
            <View style={styles.verificationView}>
              <Text style={styles.verificationEmoji}>📬</Text>
              <Text style={styles.verificationTitle}>Check your email</Text>
              <Text style={styles.verificationSub}>
                We sent a confirmation link to {email.trim()}.{"\n"}
                Click it to activate your account.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.verificationResend, pressed && styles.primaryButtonPressed]}
                onPress={() => void resendVerification()}
              >
                <Text style={styles.verificationResendText}>Resend email</Text>
              </Pressable>
              <Pressable onPress={() => router.replace("/sign-in")}>
                <Text style={styles.verificationSignIn}>Back to sign in</Text>
              </Pressable>
              {verificationMessage ? <Text style={styles.verificationMessage}>{verificationMessage}</Text> : null}
            </View>
          ) : (
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
                <View>
                  <Field label="Password" value={password} onChangeText={setPassword} placeholder="Choose a password" />
                  {password.length > 0 ? (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthBar}>
                        <View
                          style={[
                            styles.strengthFill,
                            {
                              width: strength.width,
                              backgroundColor: strength.color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                    </View>
                  ) : null}
                </View>

                {authLoading ? (
                  <View style={styles.loadingButton}>
                    <ActivityIndicator size="small" color={colors.white} />
                    <Text style={styles.loadingButtonText}>Creating account...</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                    onPress={async () => {
                      setError("");
                      setVerificationMessage("");

                      const result = await signUp({
                        name: name.trim(),
                        email: email.trim(),
                        password,
                      });

                      if (result.error) {
                        setError(result.error);
                        return;
                      }

                      if (result.data?.user && !result.data.user.email_confirmed_at) {
                        setShowVerification(true);
                        return;
                      }

                      router.replace("/onboarding");
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Create account</Text>
                  </Pressable>
                )}

                {error || authError ? <Text style={styles.error}>{error || authError}</Text> : null}

                <Text style={styles.footerText}>
                  Already have an account?{" "}
                  <Link href="/sign-in" style={styles.footerAccent}>
                    Sign in
                  </Link>
                </Text>
              </View>
            </View>
          )}
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
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthFill: {
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: "500",
    width: 56,
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
  verificationView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  verificationEmoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  verificationTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  verificationSub: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 28,
  },
  verificationResend: {
    backgroundColor: "#F6EDE4",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 16,
  },
  verificationResendText: {
    fontSize: 15,
    color: colors.accentPrimary,
    fontWeight: "600",
  },
  verificationSignIn: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  verificationMessage: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
