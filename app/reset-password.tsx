import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError || !data.session) {
        setHasValidSession(false);
        setError("This link has expired or is invalid. Please request a new one.");
        setCheckingSession(false);
        return;
      }

      setHasValidSession(true);
      setError("");
      setCheckingSession(false);
    };

    void checkSession();

    return () => {
      isMounted = false;
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, []);

  const handleResetPassword = async () => {
    if (!hasValidSession) {
      setError("This link has expired or is invalid. Please request a new one.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccessMessage("Password updated. Taking you back in...");
    redirectTimer.current = setTimeout(() => {
      router.replace("/(tabs)/log");
    }, 1200);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View style={styles.screenWrap}>
            <View style={styles.hero}>
              <Text style={styles.wordmark}>SavorSelf</Text>
              <Text style={styles.tagline}>FOOD Â· MOOD Â· YOU</Text>
            </View>

            <View style={styles.formWrap}>
              <Text style={styles.title}>Set a new password</Text>
              <Text style={styles.subtitle}>Choose a new password to get back into your account.</Text>

              {checkingSession ? (
                <View style={styles.loadingButton}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.loadingButtonText}>Checking your reset link...</Text>
                </View>
              ) : !hasValidSession ? (
                <Text style={styles.error}>This link has expired or is invalid. Please request a new one.</Text>
              ) : (
                <>
                  <Field
                    label="New password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Choose a new password"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    rightAccessory={
                      <Pressable onPress={() => setShowNewPassword((current) => !current)} style={styles.eyeButton}>
                        <Text style={styles.eyeIcon}>{showNewPassword ? "👁" : "👁‍🗨"}</Text>
                      </Pressable>
                    }
                  />
                  <Field
                    label="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm your new password"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    rightAccessory={
                      <Pressable onPress={() => setShowConfirmPassword((current) => !current)} style={styles.eyeButton}>
                        <Text style={styles.eyeIcon}>{showConfirmPassword ? "👁" : "👁‍🗨"}</Text>
                      </Pressable>
                    }
                  />

                  {loading ? (
                    <View style={styles.loadingButton}>
                      <ActivityIndicator size="small" color={colors.white} />
                      <Text style={styles.loadingButtonText}>Saving password...</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                      onPress={() => void handleResetPassword()}
                    >
                      <Text style={styles.primaryButtonText}>Update password</Text>
                    </Pressable>
                  )}

                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                </>
              )}
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
  success: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  eyeButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  eyeIcon: {
    fontSize: 18,
  },
});
