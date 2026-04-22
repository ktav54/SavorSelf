import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Card, Field, PrimaryButton, Screen, SectionTitle } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export default function SignUpScreen() {
  const signUp = useAppStore((state) => state.signUp);
  const authLoading = useAppStore((state) => state.authLoading);
  const authError = useAppStore((state) => state.authError);
  const sessionReady = useAppStore((state) => state.sessionReady);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const profile = useAppStore((state) => state.profile);
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
        <PrimaryButton
          label={authLoading ? "Creating account..." : "Create account"}
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
        {authError ? <Text style={{ color: "#C4622D", fontSize: 14 }}>{authError}</Text> : null}
      </Card>
    </Screen>
  );
}
