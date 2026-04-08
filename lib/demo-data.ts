import { formatISO, subDays } from "date-fns";
import type {
  AiConversationMessage,
  FoodLog,
  FoodMoodInsight,
  JournalEntry,
  MoodLog,
  QuickLog,
  UserProfile,
} from "@/types/models";

export const demoProfile: UserProfile = {
  id: "demo-user",
  email: "hello@savorself.app",
  name: "Avery",
  subscriptionTier: "free",
  preferredUnits: "imperial",
  onboardingComplete: false,
  dailyCalorieGoal: 2100,
  dailyProteinGoal: 110,
  dailyWaterGoal: 80,
  timezone: "America/New_York",
};

export const demoMoodLogs: MoodLog[] = Array.from({ length: 5 }).map((_, index) => ({
  id: `mood-${index}`,
  userId: "demo-user",
  loggedAt: formatISO(subDays(new Date(), 4 - index)),
  moodScore: ([3, 4, 2, 4, 5][index] as MoodLog["moodScore"]),
  energyScore: ([2, 3, 2, 4, 4][index] as MoodLog["energyScore"]),
  physicalState: index % 2 === 0 ? ["light"] : ["energized"],
  mentalState: index % 2 === 0 ? ["focused"] : ["calm"],
  notes: index === 2 ? "Felt off after a sugary snack." : "",
}));

export const demoFoodLogs: FoodLog[] = [
  {
    id: "food-1",
    userId: "demo-user",
    loggedAt: formatISO(new Date()),
    mealType: "breakfast",
    foodName: "Greek yogurt with berries",
    foodSource: "custom",
    quantity: 1,
    unit: "serving",
    calories: 240,
    proteinG: 19,
    carbsG: 24,
    fatG: 6,
    fiberG: 5,
    sugarG: 13,
    micronutrients: { calcium_mg: 220, magnesium_mg: 35, vitamin_b12_mcg: 0.7 },
    gutHealthTags: ["probiotic", "high_fiber"],
    preLogged: false,
  },
  {
    id: "food-2",
    userId: "demo-user",
    loggedAt: formatISO(new Date()),
    mealType: "lunch",
    foodName: "Salmon grain bowl",
    foodSource: "custom",
    quantity: 1,
    unit: "serving",
    calories: 540,
    proteinG: 34,
    carbsG: 46,
    fatG: 22,
    fiberG: 9,
    sugarG: 7,
    micronutrients: { omega3_mg: 1800, magnesium_mg: 110, vitamin_d_iu: 420 },
    gutHealthTags: ["anti_inflammatory", "high_fiber"],
    preLogged: true,
  },
];

export const demoQuickLogs: QuickLog[] = [
  {
    id: "quick-1",
    userId: "demo-user",
    loggedAt: formatISO(new Date()),
    waterOz: 54,
    caffeineMg: 95,
    steps: 6120,
    sleepHours: 7.5,
    exerciseMinutes: 25,
    exerciseType: "walk",
  },
];

export const demoJournalEntries: JournalEntry[] = [
  {
    id: "journal-1",
    userId: "demo-user",
    createdAt: formatISO(subDays(new Date(), 1)),
    promptUsed: "How did your body feel today?",
    body: "More settled after lunch than I expected. The morning coffee hit a little hard.",
    isGraceMode: false,
  },
  {
    id: "journal-2",
    userId: "demo-user",
    createdAt: formatISO(subDays(new Date(), 3)),
    promptUsed: "What gave you energy and what drained it?",
    body: "Protein at breakfast helped. Afternoon sweets left me foggy.",
    isGraceMode: false,
  },
];

export const demoInsights: FoodMoodInsight[] = [
  {
    id: "insight-1",
    userId: "demo-user",
    generatedAt: formatISO(new Date()),
    insightType: "fermented_mood",
    insightBody: "Your mood scores trend higher on days you log fermented or probiotic foods.",
    supportingData: { deltaPercent: 67, tag: "fermented" },
    isRead: false,
  },
  {
    id: "insight-2",
    userId: "demo-user",
    generatedAt: formatISO(new Date()),
    insightType: "protein_energy",
    insightBody: "Your steadiest energy days this week began with at least 20g of morning protein.",
    supportingData: { morningProteinDays: 3 },
    isRead: true,
  },
];

export const demoConversation: AiConversationMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I'm here with you. Based on your recent logs, your energy looks steadier on the days you start with protein and get a bit more sleep. Want to look at what's been different lately?",
    timestamp: formatISO(new Date()),
  },
];
