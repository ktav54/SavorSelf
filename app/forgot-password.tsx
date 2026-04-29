import { router } from "expo-router";
import { useState } from "react";
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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "savorself://reset-password",
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View style={styles.screenWrap}>
            <Pressable onPress={() => router.back()} style={styles.backLinkWrap}>
              <Text style={styles.backLink}>Back to sign in</Text>
            </Pressable>

            <View style={styles.hero}>
              <Text style={styles.wordmark}>SavorSelf</Text>
              <Text style={styles.tagline}>FOOD · MOOD · YOU</Text>
            </View>

            {sent ? (
              <View style={styles.sentState}>
                <Text style={styles.sentEmoji}>📬</Text>
                <Text style={styles.sentTitle}>Check your email</Text>
                <Text style={styles.sentSub}>We sent a password reset link to {email.trim()}.</Text>
                <Pressable onPress={() => router.back()}>
                  <Text style={styles.backLink}>Back to sign in</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.formWrap}>
                <Text style={styles.title}>Reset your password</Text>
                <Text style={styles.subtitle}>
                  We'll send your reset link to the email you use for SavorSelf.
                </Text>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                  onPress={() => void handleReset()}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={colors.white} />
                      <Text style={styles.primaryButtonText}>Sending...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryButtonText}>Send reset link</Text>
                  )}
                </Pressable>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}
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
    backgroundColor: colors.background,
  },
  backLinkWrap: {
    alignSelf: "flex-start",
    marginTop: 8,
    marginBottom: 28,
  },
  backLink: {
    color: colors.textSecondary,
    fontSize: 15,
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
    marginTop: 8,
  },
  sentState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 12,
  },
  sentEmoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  sentTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.textPrimary,
    textAlign: "center",
  },
  sentSub: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 12,
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    color: colors.accentPrimary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
