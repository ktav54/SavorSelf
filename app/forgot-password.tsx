import { useState } from "react";
import { Card, Field, PrimaryButton, Screen, SectionTitle } from "@/components/ui";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");

  return (
    <Screen>
      <SectionTitle
        eyebrow="Reset"
        title="Reset your password"
        subtitle="This is the handoff point for a Supabase password reset email."
      />
      <Card>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <PrimaryButton label="Send reset link" />
      </Card>
    </Screen>
  );
}
