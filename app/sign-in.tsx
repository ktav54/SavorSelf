import { Link, router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useState } from "react";
import { Card, Field, PrimaryButton, Screen, SectionTitle } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export default function SignInScreen() {
  const signIn = useAppStore((state) => state.signIn);
  const authLoading = useAppStore((state) => state.authLoading);
  const authError = useAppStore((state) => state.authError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        <PrimaryButton
          label={authLoading ? "Signing in..." : "Sign in"}
          onPress={async () => {
            const result = await signIn(email.trim(), password);
            if (!result.error) {
              router.replace("/");
            }
          }}
        />
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
});
