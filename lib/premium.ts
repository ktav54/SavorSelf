import type { UserProfile } from "@/types/models";

export const isPremium = (profile?: UserProfile | null) =>
  profile?.subscriptionTier === "premium";

export const featureFlags = {
  foodMoodHistoryDays: (profile?: UserProfile | null) =>
    isPremium(profile) ? 30 : 3,
  coachMessagesPerDay: (profile?: UserProfile | null) =>
    isPremium(profile) ? 999 : 10,
  canSeeNutrientSpotlight: (profile?: UserProfile | null) => isPremium(profile),
  canSeeThirtyDayTrends: (profile?: UserProfile | null) => isPremium(profile),
  canUseProactiveCheckIns: (profile?: UserProfile | null) => isPremium(profile),
  canSeeFullAiHistory: (profile?: UserProfile | null) => isPremium(profile),
};
