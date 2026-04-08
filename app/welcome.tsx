import { Link, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { Card, PrimaryButton, Screen, SectionTitle } from "@/components/ui";

export default function WelcomeScreen() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.logo}>SavorSelf</Text>
        <SectionTitle
          title="Savor what you eat. Understand how you feel."
          subtitle="A mood-first food and wellness journal designed around grace, pattern-finding, and the gut-brain connection."
        />
      </View>
      <Card>
        <PrimaryButton label="Let's begin" onPress={() => router.push("/sign-up")} />
        <Link href="/sign-in" style={styles.link}>
          I already have an account
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  logo: {
    fontSize: 40,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  link: {
    color: colors.accentPrimary,
    textAlign: "center",
    marginTop: 12,
    fontSize: 16,
  },
});
