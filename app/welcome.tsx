import { Link, router } from "expo-router";
import { useEffect } from "react";
import { useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { Card, PrimaryButton, Screen } from "@/components/ui";
import { useAppStore, type AppState } from "@/store/useAppStore";

export default function WelcomeScreen() {
  const sessionReady = useAppStore((state: AppState) => state.sessionReady);
  const isAuthenticated = useAppStore((state: AppState) => state.isAuthenticated);
  const profile = useAppStore((state: AppState) => state.profile);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!sessionReady || !isAuthenticated) {
      return;
    }

    router.replace(profile?.onboardingComplete ? "/(tabs)/log" : "/onboarding");
  }, [isAuthenticated, profile?.onboardingComplete, sessionReady]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  if (!sessionReady) {
    return (
      <Screen>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading SavorSelf...</Text>
        </View>
      </Screen>
    );
  }

  if (isAuthenticated) {
    return (
      <Screen>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Welcome back...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.screen}>
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.logo}>SavorSelf</Text>
          <Text style={styles.tagline}>Food. Mood. You.</Text>
          <View style={styles.copyBlock}>
            <Text style={styles.heroTitle}>Savor what you eat. Understand how you feel.</Text>
            <Text style={styles.heroSubtitle}>
              Most people don't realize how much what they eat shapes how they feel.{"\n"}
              SavorSelf helps you find your personal pattern.
            </Text>
          </View>
        </Animated.View>
        <View style={styles.bottomCardWrap}>
          <Card>
            <View style={styles.proofPoints}>
              {[
                { emoji: "🧠", text: "Gut-brain science, personalized" },
                { emoji: "📊", text: "Your data, your patterns" },
                { emoji: "✨", text: "No calorie obsessing required" },
              ].map((point) => (
                <View key={point.text} style={styles.proofPoint}>
                  <Text style={styles.proofEmoji}>{point.emoji}</Text>
                  <Text style={styles.proofText}>{point.text}</Text>
                </View>
              ))}
            </View>
            <PrimaryButton label="Let's begin" onPress={() => router.push("/sign-up")} />
            <Link href="/sign-in" style={styles.link}>
              I already have an account
            </Link>
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  logo: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  tagline: {
    fontSize: 16,
    color: colors.accentPrimary,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  copyBlock: {
    gap: 8,
  },
  bottomCardWrap: {
    marginTop: "auto",
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 28,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  proofPoints: {
    gap: 12,
    marginBottom: 32,
    alignSelf: "stretch",
  },
  proofPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  proofEmoji: {
    fontSize: 20,
  },
  proofText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 1,
  },
  link: {
    color: colors.accentPrimary,
    textAlign: "center",
    marginTop: 16,
    fontSize: 15,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.textPrimary,
    fontSize: 18,
  },
});
