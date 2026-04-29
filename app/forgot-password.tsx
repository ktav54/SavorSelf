import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Field, Screen } from "@/components/ui";
import { colors } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");

  return (
    <Screen>
      <View style={styles.screenWrap}>
        <Link href="/sign-in" style={styles.backLink}>
          Back to sign in ←
        </Link>

        <View style={styles.hero}>
          <Text style={styles.wordmark}>SavorSelf</Text>
          <Text style={styles.tagline}>FOOD · MOOD · YOU</Text>
        </View>

        <View style={styles.formWrap}>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>We&apos;ll send your reset link to the email you use for SavorSelf.</Text>
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
            <Text style={styles.primaryButtonText}>Send reset link</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  backLink: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 8,
    marginBottom: 28,
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
});
