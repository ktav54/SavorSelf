import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { Card, Chip, PrimaryButton, Screen, SectionTitle } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export default function SettingsScreen() {
  const profile = useAppStore((state) => state.profile);
  const signOut = useAppStore((state) => state.signOut);

  return (
    <Screen scroll>
      <SectionTitle
        eyebrow="Settings"
        title="Preferences, goals, and account"
        subtitle="Units, notification timing, premium state, and account actions all have a home here."
      />
      <Card>
        <Text style={styles.heading}>Units</Text>
        <View style={styles.row}>
          <Chip label="Imperial" active={profile?.preferredUnits === "imperial"} />
          <Chip label="Metric" active={profile?.preferredUnits === "metric"} />
        </View>
      </Card>
      <Card>
        <Text style={styles.heading}>Goals</Text>
        <Text style={styles.body}>Calories: {profile?.dailyCalorieGoal ?? "Not set"}</Text>
        <Text style={styles.body}>Protein: {profile?.dailyProteinGoal ?? "Not set"}</Text>
        <Text style={styles.body}>Water: {profile?.dailyWaterGoal ?? "Not set"}</Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Subscription</Text>
        <Text style={styles.body}>Tier: {profile?.subscriptionTier ?? "free"}</Text>
        <Text style={styles.body}>RevenueCat can plug in here when monetization turns on.</Text>
      </Card>
      <Card>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.body}>Daily morning check-in</Text>
        <Text style={styles.body}>Two-day lapse nudge</Text>
        <Text style={styles.body}>Weekly Food-Mood report</Text>
      </Card>
      <PrimaryButton label="Sign out" secondary onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
});
