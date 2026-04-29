export type SubscriptionTier = "free" | "premium";
export type PreferredUnits = "imperial" | "metric";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type FoodSource = "usda" | "open_food_facts" | "ai_estimate" | "custom";
export type FoodUnit = "g" | "oz" | "ml" | "fl_oz" | "cup" | "serving" | "piece" | "tbsp" | "tsp";

export type PhysicalState =
  | "bloated"
  | "energized"
  | "foggy"
  | "strong"
  | "tired"
  | "sore"
  | "light"
  | "heavy";

export type MentalState =
  | "anxious"
  | "content"
  | "overwhelmed"
  | "calm"
  | "motivated"
  | "irritable"
  | "focused"
  | "scattered";

export type GutHealthTag =
  | "fermented"
  | "prebiotic"
  | "probiotic"
  | "high_fiber"
  | "anti_inflammatory"
  | "processed";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  avatarEmoji?: string | null;
  subscriptionTier: SubscriptionTier;
  preferredUnits: PreferredUnits;
  onboardingComplete: boolean;
  dailyCalorieGoal?: number;
  dailyProteinGoal?: number;
  dailyCarbsGoal?: number;
  dailyFatGoal?: number;
  dailyWaterGoal?: number;
  onboardingGoal?: string;
  onboardingChallenge?: string;
  timezone: string;
}

export interface MoodLog {
  id: string;
  userId: string;
  loggedAt: string;
  moodScore: 1 | 2 | 3 | 4 | 5;
  energyScore: 1 | 2 | 3 | 4 | 5;
  physicalState: PhysicalState[];
  mentalState: MentalState[];
  notes?: string;
}

export interface FoodLog {
  id: string;
  userId: string;
  loggedAt: string;
  mealType: MealType;
  foodName: string;
  foodSource: FoodSource;
  externalFoodId?: string;
  quantity: number;
  unit: FoodUnit;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  micronutrients: Record<string, number>;
  gutHealthTags: GutHealthTag[];
  preLogged: boolean;
}

export interface QuickLog {
  id: string;
  userId: string;
  loggedAt: string;
  waterOz?: number;
  caffeineMg?: number;
  steps?: number;
  sleepHours?: number;
  exerciseMinutes?: number;
  exerciseType?: string;
}

export interface AiConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  kind?: "text" | "food_summary" | "clarification" | "status";
  foodProposal?: CoachFoodProposal;
}

export interface FoodMoodInsight {
  id: string;
  userId: string;
  generatedAt: string;
  insightType: string;
  insightBody: string;
  supportingData: Record<string, unknown>;
  isRead: boolean;
}

export interface FoodMoodTrendPoint {
  date: string;
  moodScore: number | null;
  fiber: number;
  protein: number;
  fermentedCount: number;
  sleepHours: number;
  caffeineMg: number;
}

export interface FoodMoodSnapshot {
  averageMoodThisWeek: number | null;
  averageMoodLastWeek: number | null;
  moodDelta: number | null;
  topTag: string | null;
  daysLoggedThisWeek: number;
}

export interface CoachFoodItem {
  name: string;
  portion: string;
  foodSource: Exclude<FoodSource, "custom">;
  externalFoodId?: string;
  quantity: number;
  unit: FoodUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

export interface CoachFoodProposal {
  mealType: MealType;
  needsClarification: boolean;
  question?: string;
  isFoodLogging?: boolean;
  items: CoachFoodItem[];
  sourceMessage: string;
}
