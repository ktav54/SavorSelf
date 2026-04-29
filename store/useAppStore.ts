import { endOfDay, startOfDay } from "date-fns";
import { Session, User } from "@supabase/supabase-js";
import { create, type StateCreator, type StoreApi, type UseBoundStore } from "zustand";
import { analyzeFoodMood, generateAiNarrative } from "@/lib/food-mood";
import { demoInsights, demoQuickLogs } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
import { cancelAllSavorSelfNotifications, scheduleLapseNudge } from "@/services/notifications";
import { formatFoodName } from "@/lib/utils";
import type {
  AiConversationMessage,
  FoodSource,
  FoodUnit,
  FoodLog,
  MealType,
  FoodMoodInsight,
  FoodMoodSnapshot,
  FoodMoodTrendPoint,
  MoodLog,
  QuickLog,
  UserProfile,
} from "@/types/models";

export interface AppState {
  sessionReady: boolean;
  isAuthenticated: boolean;
  authUser: User | null;
  profile: UserProfile | null;
  selectedDate: Date;
  moodLogs: MoodLog[];
  foodLogs: FoodLog[];
  quickLogs: QuickLog[];
  insights: FoodMoodInsight[];
  foodMoodSnapshot: FoodMoodSnapshot | null;
  foodMoodTrend: FoodMoodTrendPoint[];
  aiNarrative: string;
  conversation: AiConversationMessage[];
  conversationResetCount: number;
  authError: string | null;
  authLoading: boolean;
  moodLoading: boolean;
  moodError: string | null;
  foodLoading: boolean;
  foodError: string | null;
  insightsLoading: boolean;
  insightsError: string | null;
  initializeAuth: () => Promise<void>;
  handleSessionChange: (session: Session | null) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (payload: { email: string; password: string; name?: string }) => Promise<{ error?: string }>;
  completeOnboarding: (details: Partial<UserProfile>) => Promise<{ error?: string }>;
  updateProfile: (updates: Partial<Pick<UserProfile, "name" | "preferredUnits" | "dailyCalorieGoal" | "dailyProteinGoal" | "dailyCarbsGoal" | "dailyFatGoal" | "dailyWaterGoal">>) => Promise<{ error?: string }>;
  updateEmail: (email: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
  setSelectedDate: (date: Date) => Promise<void>;
  signOut: () => Promise<void>;
  loadTodayMoodLog: (date?: Date) => Promise<void>;
  loadTodayFoodLogs: (date?: Date) => Promise<void>;
  loadTodayQuickLog: (date?: Date) => Promise<void>;
  loadFoodMoodInsights: () => Promise<void>;
  saveMoodLog: (input: Omit<MoodLog, "id" | "userId" | "loggedAt">) => Promise<{ error?: string }>;
  saveWaterLog: (waterOz: number) => Promise<{ error?: string }>;
  saveQuickField: (
    field: "caffeineMg" | "steps" | "sleepHours" | "exerciseMinutes",
    value: number
  ) => Promise<{ error?: string }>;
  saveFoodLog: (input: {
    foodName: string;
    foodSource?: FoodSource;
    externalFoodId?: string;
    mealType: MealType;
    quantity: number;
    unit: FoodUnit;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG?: number;
    sugarG?: number;
  }) => Promise<{ error?: string }>;
  saveMultipleFoodLogs: (items: Array<{
    foodName: string;
    foodSource?: FoodSource;
    externalFoodId?: string;
    mealType: MealType;
    quantity: number;
    unit: FoodUnit;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG?: number;
    sugarG?: number;
  }>) => Promise<{ error?: string }>;
  deleteFoodLog: (foodLogId: string) => Promise<{ error?: string }>;
  updateFoodLog: (updates: {
    id: string;
    quantity: number;
    unit: FoodUnit;
    mealType: MealType;
  }) => Promise<{ error?: string }>;
  addMoodLog: (log: MoodLog) => void;
  addFoodLog: (log: FoodLog) => void;
  addQuickLog: (log: QuickLog) => void;
  saveConversation: () => Promise<void>;
  loadConversation: () => Promise<void>;
  getFrequentFoods: (mealType: MealType, limit?: number) => FoodLog[];
  addCoachMessage: (message: AiConversationMessage) => void;
  deleteCoachMessage: (timestamp: string, index: number) => void;
  clearConversation: () => void;
}

function normalizeSelectedDate(date?: Date) {
  const next = date ? new Date(date) : new Date();
  next.setHours(0, 0, 0, 0);
  return next;
}

function getDayWindow(date?: Date) {
  const target = normalizeSelectedDate(date);
  return {
    target,
    start: startOfDay(target).toISOString(),
    end: endOfDay(target).toISOString(),
  };
}

function toDateKey(value: string | Date) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function parseCoachConversation(
  value: unknown
): AiConversationMessage[] | null {
  if (!value) {
    return [];
  }

  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        })()
      : value;

  if (!Array.isArray(parsed)) {
    return null;
  }

  const normalized = parsed.filter((item): item is AiConversationMessage => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Record<string, unknown>;
    return (
      (candidate.role === "user" || candidate.role === "assistant") &&
      typeof candidate.content === "string" &&
      typeof candidate.timestamp === "string"
    );
  });

  return normalized;
}

function getRecentDateKeys(count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - index + offset));
    return toDateKey(date);
  });
}

function buildFoodMoodSnapshot(moodLogs: MoodLog[], foodLogs: FoodLog[]): FoodMoodSnapshot {
  const moodByDate = new Map<string, number[]>();
  moodLogs.forEach((log) => {
    const key = toDateKey(log.loggedAt);
    moodByDate.set(key, [...(moodByDate.get(key) ?? []), log.moodScore]);
  });

  const averagedMoodByDate = new Map<string, number>(
    Array.from(moodByDate.entries()).map(([key, values]) => [key, values.reduce((sum, value) => sum + value, 0) / values.length])
  );

  const thisWeekKeys = getRecentDateKeys(7);
  const lastWeekKeys = getRecentDateKeys(7, 7);
  const thisWeekMoodScores = thisWeekKeys
    .map((key) => averagedMoodByDate.get(key) ?? null)
    .filter((value): value is number => value !== null);
  const lastWeekMoodScores = lastWeekKeys
    .map((key) => averagedMoodByDate.get(key) ?? null)
    .filter((value): value is number => value !== null);

  const thisWeekFoodLogs = foodLogs.filter((log) => thisWeekKeys.includes(toDateKey(log.loggedAt)));
  const tagCounts = new Map<string, number>();
  thisWeekFoodLogs.forEach((log) => {
    log.gutHealthTags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });

  const topTagEntry = Array.from(tagCounts.entries()).sort((left, right) => right[1] - left[1])[0] ?? null;
  const avgMoodThisWeek = average(thisWeekMoodScores);
  const avgMoodLastWeek = average(lastWeekMoodScores);
  const daysLoggedThisWeek = new Set(thisWeekFoodLogs.map((log) => toDateKey(log.loggedAt))).size;

  return {
    averageMoodThisWeek: avgMoodThisWeek != null ? roundOne(avgMoodThisWeek) : null,
    averageMoodLastWeek: avgMoodLastWeek != null ? roundOne(avgMoodLastWeek) : null,
    moodDelta: avgMoodThisWeek != null && avgMoodLastWeek != null ? roundOne(avgMoodThisWeek - avgMoodLastWeek) : null,
    topTag: topTagEntry?.[0] ?? null,
    daysLoggedThisWeek,
  };
}

function getLoggedAtForDate(date?: Date) {
  const target = normalizeSelectedDate(date);
  const now = new Date();
  target.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return target.toISOString();
}

function mapProfile(row: any): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? "",
    avatarUrl: row.avatar_url ?? undefined,
    subscriptionTier: row.subscription_tier ?? "free",
    preferredUnits: row.preferred_units ?? "imperial",
    onboardingComplete: Boolean(row.onboarding_complete),
    dailyCalorieGoal: row.daily_calorie_goal ?? undefined,
    dailyProteinGoal: row.daily_protein_goal ?? undefined,
    dailyCarbsGoal: row.daily_carbs_goal ?? undefined,
    dailyFatGoal: row.daily_fat_goal ?? undefined,
    dailyWaterGoal: row.daily_water_goal ?? undefined,
    onboardingGoal: row.onboarding_goal ?? undefined,
    onboardingChallenge: row.onboarding_challenge ?? undefined,
    timezone: row.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function mapMoodLog(row: any): MoodLog {
  return {
    id: row.id,
    userId: row.user_id,
    loggedAt: row.logged_at,
    moodScore: row.mood_score,
    energyScore: row.energy_score,
    physicalState: row.physical_state ?? [],
    mentalState: row.mental_state ?? [],
    notes: row.notes ?? "",
  };
}

function mapFoodLog(row: any): FoodLog {
  return {
    id: row.id,
    userId: row.user_id,
    loggedAt: row.logged_at,
    mealType: row.meal_type,
    foodName: formatFoodName(row.food_name),
    foodSource: row.food_source,
    externalFoodId: row.external_food_id ?? undefined,
    quantity: Number(row.quantity ?? 0),
    unit: row.unit,
    calories: Math.round(Number(row.calories ?? 0)),
    proteinG: Math.round(Number(row.protein_g ?? 0)),
    carbsG: Math.round(Number(row.carbs_g ?? 0)),
    fatG: Math.round(Number(row.fat_g ?? 0)),
    fiberG: Math.round(Number(row.fiber_g ?? 0)),
    sugarG: Math.round(Number(row.sugar_g ?? 0)),
    micronutrients: row.micronutrients ?? {},
    gutHealthTags: row.gut_health_tags ?? [],
    preLogged: Boolean(row.pre_logged),
  };
}

function mapQuickLog(row: any): QuickLog {
  return {
    id: row.id,
    userId: row.user_id,
    loggedAt: row.logged_at,
    waterOz: row.water_oz ?? undefined,
    caffeineMg: row.caffeine_mg ?? undefined,
    steps: row.steps ?? undefined,
    sleepHours: row.sleep_hours ?? undefined,
    exerciseMinutes: row.exercise_minutes ?? undefined,
    exerciseType: row.exercise_type ?? undefined,
  };
}

async function ensureProfileForSession(session: Session) {
  const authUser = session.user;

  const { data: existingProfile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (existingProfile) {
    return mapProfile(existingProfile);
  }

  const fallbackProfile = {
    id: authUser.id,
    email: authUser.email ?? "",
    name: authUser.user_metadata?.name ?? "",
    subscription_tier: "free",
    preferred_units: "imperial",
    onboarding_complete: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const { data: insertedProfile, error: upsertError } = await supabase
    .from("users")
    .upsert(fallbackProfile)
    .select("*")
    .single();

  if (upsertError) {
    throw upsertError;
  }

  return mapProfile(insertedProfile);
}

function roundNutrition(value: number) {
  return Math.round(Number(value ?? 0));
}

function getMissingUsersColumns(message?: string | null) {
  const missing: Array<
    "daily_carbs_goal" | "daily_fat_goal" | "onboarding_goal" | "onboarding_challenge"
  > = [];

  if (!message) {
    return missing;
  }

  if (message.includes("daily_carbs_goal")) {
    missing.push("daily_carbs_goal");
  }

  if (message.includes("daily_fat_goal")) {
    missing.push("daily_fat_goal");
  }

  if (message.includes("onboarding_goal")) {
    missing.push("onboarding_goal");
  }

  if (message.includes("onboarding_challenge")) {
    missing.push("onboarding_challenge");
  }

  return missing;
}

async function updateUsersRowWithFallback(userId: string, payload: Record<string, unknown>) {
  const attempt = async (nextPayload: Record<string, unknown>) =>
    supabase
      .from("users")
      .update(nextPayload)
      .eq("id", userId)
      .select("*")
      .single();

  const firstAttempt = await attempt(payload);
  const missingColumns = getMissingUsersColumns(firstAttempt.error?.message);

  if (!firstAttempt.error || missingColumns.length === 0) {
    return {
      data: firstAttempt.data,
      error: firstAttempt.error,
      missingColumns,
    };
  }

  const fallbackPayload = { ...payload };
  missingColumns.forEach((column) => {
    delete fallbackPayload[column];
  });

  const fallbackAttempt = await attempt(fallbackPayload);

  return {
    data: fallbackAttempt.data,
    error: fallbackAttempt.error,
    missingColumns,
  };
}

const appStateCreator: StateCreator<AppState> = (set) => ({
  sessionReady: false,
  isAuthenticated: false,
  authUser: null,
  profile: null,
  selectedDate: normalizeSelectedDate(),
  moodLogs: [],
  foodLogs: [],
  quickLogs: demoQuickLogs,
  insights: demoInsights,
  foodMoodSnapshot: null,
  foodMoodTrend: [],
  aiNarrative: "",
  conversation: [],
  conversationResetCount: 0,
  authError: null,
  authLoading: false,
  moodLoading: false,
  moodError: null,
  foodLoading: false,
  foodError: null,
  insightsLoading: false,
  insightsError: null,
  initializeAuth: async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      set({
        sessionReady: true,
        authError: error.message,
      });
      return;
    }

    await useAppStore.getState().handleSessionChange(data.session);
  },
  handleSessionChange: async (session) => {
    if (!session?.user) {
      set({
        sessionReady: true,
        isAuthenticated: false,
        authUser: null,
        profile: null,
        moodLogs: [],
        foodLogs: [],
        quickLogs: demoQuickLogs,
        insights: [],
        foodMoodSnapshot: null,
        foodMoodTrend: [],
        aiNarrative: "",
        conversation: [],
        conversationResetCount: 0,
        authError: null,
      });
      return;
    }

    const authUser = session.user;
    try {
      const profile = await ensureProfileForSession(session);

      set({
        sessionReady: true,
        isAuthenticated: true,
        authUser,
        profile,
        quickLogs: [],
        conversation: [],
        conversationResetCount: 0,
        authError: null,
      });

      await useAppStore.getState().loadConversation();
      await useAppStore.getState().loadTodayMoodLog();
      await useAppStore.getState().loadTodayFoodLogs();
      await useAppStore.getState().loadFoodMoodInsights();
      await useAppStore.getState().loadTodayQuickLog();
    } catch (error) {
      set({
        sessionReady: true,
        isAuthenticated: true,
        authUser,
        authError: error instanceof Error ? error.message : "Unable to load your profile.",
      });
    }
  },
  signIn: async (email, password) => {
    set({
      authLoading: true,
      authError: null,
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.session) {
      await useAppStore.getState().handleSessionChange(data.session);
    }

    set({
      authLoading: false,
      authError: error?.message ?? null,
    });

    return error ? { error: error.message } : {};
  },
  signUp: async ({ email, password, name }) => {
    set({
      authLoading: true,
      authError: null,
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name ?? "",
        },
      },
    });

    if (!error && data.session) {
      await useAppStore.getState().handleSessionChange(data.session);
    } else if (!error && data.user) {
      await supabase.from("users").upsert({
        id: data.user.id,
        email: data.user.email ?? email,
        name: name ?? "",
        subscription_tier: "free",
        preferred_units: "imperial",
        onboarding_complete: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      const signInResult = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInResult.error && signInResult.data.session) {
        await useAppStore.getState().handleSessionChange(signInResult.data.session);
      }
    }

    set({
      authLoading: false,
      authError: error?.message ?? null,
    });

    return error ? { error: error.message } : {};
  },
  completeOnboarding: async (details) => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return { error: "You need to be signed in before completing onboarding." };
    }

    const nextProfile = {
      ...profile,
      ...details,
      onboardingComplete: true,
    };

    set({
      profile: nextProfile,
    });

    const payload = {
      name: nextProfile.name,
      preferred_units: nextProfile.preferredUnits,
      onboarding_complete: true,
      daily_calorie_goal: nextProfile.dailyCalorieGoal ?? null,
      daily_protein_goal: nextProfile.dailyProteinGoal ?? null,
      daily_carbs_goal: nextProfile.dailyCarbsGoal ?? null,
      daily_fat_goal: nextProfile.dailyFatGoal ?? null,
      daily_water_goal: nextProfile.dailyWaterGoal ?? null,
      onboarding_goal: nextProfile.onboardingGoal ?? null,
      onboarding_challenge: nextProfile.onboardingChallenge ?? null,
    };

    const { data, error, missingColumns } = await updateUsersRowWithFallback(profile.id, payload);

    if (error) {
      set({
        profile,
      });
      return { error: error.message };
    }

    set({
      profile: mapProfile(data),
    });

    if (missingColumns.length > 0) {
      return {
        error: "Your profile saved, but some onboarding and goal fields need a quick Supabase table update before they can be stored.",
      };
    }

    return {};
  },
  updateProfile: async (updates) => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    const payload: Record<string, unknown> = {};

    if ("name" in updates) {
      payload.name = updates.name ?? "";
    }

    if ("preferredUnits" in updates) {
      payload.preferred_units = updates.preferredUnits;
    }

    if ("dailyCalorieGoal" in updates) {
      payload.daily_calorie_goal = updates.dailyCalorieGoal ?? null;
    }

    if ("dailyProteinGoal" in updates) {
      payload.daily_protein_goal = updates.dailyProteinGoal ?? null;
    }

    if ("dailyCarbsGoal" in updates) {
      payload.daily_carbs_goal = updates.dailyCarbsGoal ?? null;
    }

    if ("dailyFatGoal" in updates) {
      payload.daily_fat_goal = updates.dailyFatGoal ?? null;
    }

    if ("dailyWaterGoal" in updates) {
      payload.daily_water_goal = updates.dailyWaterGoal ?? null;
    }

    const { data, error, missingColumns } = await updateUsersRowWithFallback(profile.id, payload);

    if (error) {
      return { error: error.message };
    }

    set({
      profile: mapProfile(data),
    });

    if (missingColumns.length > 0) {
      return {
        error: "Calories, protein, and water can save, but carbs and fat goals need a quick Supabase table update first.",
      };
    }

    return {};
  },
  updateEmail: async (email): Promise<{ error?: string }> => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { error: "Enter an email address first." };
    }

    const { error: authError } = await supabase.auth.updateUser({
      email: trimmedEmail,
    });

    if (authError) {
      return { error: authError.message };
    }

    const { data, error } = await supabase
      .from("users")
      .update({ email: trimmedEmail })
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error) {
      return { error: error.message };
    }

    set({
      profile: mapProfile(data),
    });

    return {};
  },
  deleteAccount: async () => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return { error: "Not signed in." };
    }

    const tables = ["food_logs", "mood_logs", "quick_logs", "journal_entries"];
    for (const table of tables) {
      await supabase.from(table).delete().eq("user_id", profile.id);
    }

    await supabase.from("users").delete().eq("id", profile.id);
    await supabase.auth.signOut();

    set({
      isAuthenticated: false,
      authUser: null,
      profile: null,
      selectedDate: normalizeSelectedDate(),
      moodLogs: [],
      foodLogs: [],
      quickLogs: [],
      aiNarrative: "",
      conversation: [],
      conversationResetCount: 0,
      authError: null,
    });

    return {};
  },
  setSelectedDate: async (date) => {
    const target = normalizeSelectedDate(date);
    set({
      selectedDate: target,
    });
    await Promise.all([
      useAppStore.getState().loadTodayMoodLog(target),
      useAppStore.getState().loadTodayFoodLogs(target),
      useAppStore.getState().loadTodayQuickLog(target),
    ]);
  },
  signOut: async () => {
    await cancelAllSavorSelfNotifications();
    await supabase.auth.signOut();
    set({
      isAuthenticated: false,
      authUser: null,
      profile: null,
      selectedDate: normalizeSelectedDate(),
      moodLogs: [],
      foodLogs: [],
      quickLogs: [],
      aiNarrative: "",
      conversation: [],
      conversationResetCount: 0,
      authError: null,
    });
  },
  loadTodayMoodLog: async (date) => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return;
    }

    set({
      moodLoading: true,
      moodError: null,
    });

    const { start, end } = getDayWindow(date ?? useAppStore.getState().selectedDate);

    const { data, error } = await supabase
      .from("mood_logs")
      .select("*")
      .eq("user_id", profile.id)
      .gte("logged_at", start)
      .lte("logged_at", end)
      .order("logged_at", { ascending: false })
      .limit(1);

    if (error) {
      set({
        moodLoading: false,
        moodError: error.message,
      });
      return;
    }

    set({
      moodLogs: (data ?? []).map(mapMoodLog),
      moodLoading: false,
      moodError: null,
    });

    const { data: recentLog } = await supabase
      .from("mood_logs")
      .select("logged_at")
      .eq("user_id", profile.id)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    void scheduleLapseNudge(recentLog?.logged_at ?? null);
  },
  loadTodayFoodLogs: async (date) => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return;
    }

    set({
      foodLoading: true,
      foodError: null,
    });

    const { start, end } = getDayWindow(date ?? useAppStore.getState().selectedDate);

    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", profile.id)
      .gte("logged_at", start)
      .lte("logged_at", end)
      .order("logged_at", { ascending: true });

    if (error) {
      set({
        foodLoading: false,
        foodError: error.message,
      });
      return;
    }

    set({
      foodLogs: (data ?? []).map(mapFoodLog),
      foodLoading: false,
      foodError: null,
    });
  },
  loadTodayQuickLog: async (date) => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return;
    }

    const { start, end } = getDayWindow(date ?? useAppStore.getState().selectedDate);

    const { data, error } = await supabase
      .from("quick_logs")
      .select("*")
      .eq("user_id", profile.id)
      .gte("logged_at", start)
      .lte("logged_at", end)
      .order("logged_at", { ascending: false })
      .limit(1);

    if (error) {
      return;
    }

    set({
      quickLogs: (data ?? []).map(mapQuickLog),
    });
  },
  loadFoodMoodInsights: async () => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return;
    }

    set({
      insightsLoading: true,
      insightsError: null,
    });

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const start = since.toISOString();

    const [{ data: moodData, error: moodError }, { data: foodData, error: foodError }, { data: quickData, error: quickError }] =
      await Promise.all([
        supabase
          .from("mood_logs")
          .select("*")
          .eq("user_id", profile.id)
          .gte("logged_at", start)
          .order("logged_at", { ascending: true }),
        supabase
          .from("food_logs")
          .select("*")
          .eq("user_id", profile.id)
          .gte("logged_at", start)
          .order("logged_at", { ascending: true }),
        supabase
          .from("quick_logs")
          .select("*")
          .eq("user_id", profile.id)
          .gte("logged_at", start)
          .order("logged_at", { ascending: true }),
      ]);

    if (moodError || foodError || quickError) {
      set({
        insightsLoading: false,
        insightsError: moodError?.message ?? foodError?.message ?? quickError?.message ?? "Unable to load Food-Mood insights.",
      });
      return;
    }

    const moodLogs = (moodData ?? [])
      .map(mapMoodLog)
      .sort((left, right) => right.loggedAt.localeCompare(left.loggedAt));
    const foodLogs = (foodData ?? [])
      .map(mapFoodLog)
      .sort((left, right) => left.loggedAt.localeCompare(right.loggedAt));
    const quickLogs = (quickData ?? []).map(mapQuickLog);

    const analysis = analyzeFoodMood({
      userId: profile.id,
      moodLogs,
      foodLogs,
      quickLogs,
    });
    const snapshot = buildFoodMoodSnapshot(moodLogs, foodLogs);

    set({
      moodLogs,
      foodLogs,
      insights: analysis.insights,
      foodMoodSnapshot: snapshot,
      foodMoodTrend: analysis.trend,
      insightsLoading: false,
      insightsError: null,
    });

    try {
      const aiNarrative = await generateAiNarrative({
        insights: analysis.insights,
        snapshot,
        trend: analysis.trend,
        moodLogs,
        foodLogs,
      });

      set({
        aiNarrative,
      });
    } catch {
      set({
        aiNarrative: "",
      });
    }
  },
  saveMoodLog: async (input) => {
    const profile = useAppStore.getState().profile;
    const selectedDate = useAppStore.getState().selectedDate;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    set({
      moodLoading: true,
      moodError: null,
    });

    const { start, end } = getDayWindow(selectedDate);

    const { data: existing } = await supabase
      .from("mood_logs")
      .select("id")
      .eq("user_id", profile.id)
      .gte("logged_at", start)
      .lte("logged_at", end)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      user_id: profile.id,
      logged_at: getLoggedAtForDate(selectedDate),
      mood_score: input.moodScore,
      energy_score: input.energyScore,
      physical_state: input.physicalState,
      mental_state: input.mentalState,
      notes: input.notes ?? "",
    };

    const query = existing?.id
      ? supabase.from("mood_logs").update(payload).eq("id", existing.id).select("*").single()
      : supabase.from("mood_logs").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error) {
      set({
        moodLoading: false,
        moodError: error.message,
      });
      return { error: error.message };
    }

    const savedLog = mapMoodLog(data);

    set({
      moodLogs: [savedLog],
      moodLoading: false,
      moodError: null,
    });

    return {};
  },
  saveWaterLog: async (waterOz) => {
    const profile = useAppStore.getState().profile;
    const selectedDate = useAppStore.getState().selectedDate;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    const { start, end } = getDayWindow(selectedDate);

    const { data: existing, error: existingError } = await supabase
      .from("quick_logs")
      .select("*")
      .eq("user_id", profile.id)
      .gte("logged_at", start)
      .lte("logged_at", end)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return { error: existingError.message };
    }

    const payload = {
      user_id: profile.id,
      logged_at: getLoggedAtForDate(selectedDate),
      water_oz: Number(existing?.water_oz ?? 0) + waterOz,
    };

    const query = existing?.id
      ? supabase.from("quick_logs").update(payload).eq("id", existing.id).select("*").single()
      : supabase.from("quick_logs").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    set({
      quickLogs: [mapQuickLog(data)],
    });

    return {};
  },
  saveQuickField: async (field, value) => {
    const profile = useAppStore.getState().profile;
    const selectedDate = useAppStore.getState().selectedDate;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    const columnMap = {
      caffeineMg: "caffeine_mg",
      steps: "steps",
      sleepHours: "sleep_hours",
      exerciseMinutes: "exercise_minutes",
    } as const;

    const { start, end } = getDayWindow(selectedDate);

    const { data: existing, error: existingError } = await supabase
      .from("quick_logs")
      .select("*")
      .eq("user_id", profile.id)
      .gte("logged_at", start)
      .lte("logged_at", end)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return { error: existingError.message };
    }

    const column = columnMap[field];
    const query = existing?.id
      ? supabase
          .from("quick_logs")
          .update({ [column]: value })
          .eq("id", existing.id)
          .select("*")
          .single()
      : supabase
          .from("quick_logs")
          .insert({
            user_id: profile.id,
            logged_at: getLoggedAtForDate(selectedDate),
            [column]: value,
          })
          .select("*")
          .single();

    const { error } = await query;

    if (error) {
      return { error: error.message };
    }

    await useAppStore.getState().loadTodayQuickLog(selectedDate);
    return {};
  },
  saveFoodLog: async (input) => {
    const profile = useAppStore.getState().profile;
    const selectedDate = useAppStore.getState().selectedDate;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    set({
      foodLoading: true,
      foodError: null,
    });

    const payload = {
      user_id: profile.id,
      logged_at: getLoggedAtForDate(selectedDate),
      meal_type: input.mealType,
      food_name: formatFoodName(input.foodName),
      food_source: input.foodSource ?? "usda",
      external_food_id: input.externalFoodId ?? null,
      quantity: input.quantity,
      unit: input.unit,
      calories: roundNutrition(input.calories),
      protein_g: roundNutrition(input.proteinG),
      carbs_g: roundNutrition(input.carbsG),
      fat_g: roundNutrition(input.fatG),
      fiber_g: roundNutrition(input.fiberG ?? 0),
      sugar_g: roundNutrition(input.sugarG ?? 0),
      micronutrients: {},
      gut_health_tags: [],
      pre_logged: false,
    };

    const { data, error } = await supabase
      .from("food_logs")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      set({
        foodLoading: false,
        foodError: error.message,
      });
      return { error: error.message };
    }

    const savedFood = mapFoodLog(data);

    set((state) => ({
      foodLogs: [...state.foodLogs, savedFood],
      foodLoading: false,
      foodError: null,
    }));

    return {};
  },
  saveMultipleFoodLogs: async (items) => {
    const profile = useAppStore.getState().profile;
    const selectedDate = useAppStore.getState().selectedDate;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    if (!items.length) {
      return { error: "No foods were provided to save." };
    }

    set({
      foodLoading: true,
      foodError: null,
    });

    const payload = items.map((item) => ({
      user_id: profile.id,
      logged_at: getLoggedAtForDate(selectedDate),
      meal_type: item.mealType,
      food_name: formatFoodName(item.foodName),
      food_source: item.foodSource ?? "usda",
      external_food_id: item.externalFoodId ?? null,
      quantity: item.quantity,
      unit: item.unit,
      calories: roundNutrition(item.calories),
      protein_g: roundNutrition(item.proteinG),
      carbs_g: roundNutrition(item.carbsG),
      fat_g: roundNutrition(item.fatG),
      fiber_g: roundNutrition(item.fiberG ?? 0),
      sugar_g: roundNutrition(item.sugarG ?? 0),
      micronutrients: {},
      gut_health_tags: [],
      pre_logged: false,
    }));

    console.log("[store] saveMultipleFoodLogs payload", payload);

    const { data, error } = await supabase
      .from("food_logs")
      .insert(payload)
      .select("*");

    if (error) {
      console.log("[store] saveMultipleFoodLogs error", error.message);
      set({
        foodLoading: false,
        foodError: error.message,
      });
      return { error: error.message };
    }

    console.log("[store] saveMultipleFoodLogs success", data);

    const savedFoods = (data ?? []).map(mapFoodLog);

    set((state) => ({
      foodLogs: [...state.foodLogs, ...savedFoods],
      foodLoading: false,
      foodError: null,
    }));

    return {};
  },
  deleteFoodLog: async (foodLogId) => {
    set({
      foodError: null,
    });

    const { error } = await supabase.from("food_logs").delete().eq("id", foodLogId);

    if (error) {
      set({
        foodError: error.message,
      });
      return { error: error.message };
    }

    set((state) => ({
      foodLogs: state.foodLogs.filter((item) => item.id !== foodLogId),
      foodError: null,
    }));

    return {};
  },
  updateFoodLog: async (updates) => {
    set({
      foodError: null,
    });

    if (!Number.isFinite(updates.quantity) || updates.quantity <= 0) {
      set({
        foodError: "Enter a quantity greater than zero.",
      });
      return { error: "Enter a quantity greater than zero." };
    }

    const currentItem = useAppStore
      .getState()
      .foodLogs.find((item) => item.id === updates.id);

    if (!currentItem) {
      set({
        foodError: "We couldn't find that food entry.",
      });
      return { error: "We couldn't find that food entry." };
    }

    const multiplier = updates.quantity / Math.max(currentItem.quantity, 1);
    const payload = {
      quantity: updates.quantity,
      unit: updates.unit,
      meal_type: updates.mealType,
      calories: roundNutrition(currentItem.calories * multiplier),
      protein_g: roundNutrition(currentItem.proteinG * multiplier),
      carbs_g: roundNutrition(currentItem.carbsG * multiplier),
      fat_g: roundNutrition(currentItem.fatG * multiplier),
      fiber_g: roundNutrition((currentItem.fiberG ?? 0) * multiplier),
      sugar_g: roundNutrition((currentItem.sugarG ?? 0) * multiplier),
    };

    const { error } = await supabase
      .from("food_logs")
      .update(payload)
      .eq("id", updates.id);

    if (error) {
      set({
        foodError: error.message,
      });
      return { error: error.message };
    }

    await useAppStore.getState().loadTodayFoodLogs(useAppStore.getState().selectedDate);

    return {};
  },
  addMoodLog: (log) => set((state) => ({ moodLogs: [log, ...state.moodLogs] })),
  addFoodLog: (log) => set((state) => ({ foodLogs: [log, ...state.foodLogs] })),
  addQuickLog: (log) => set((state) => ({ quickLogs: [log, ...state.quickLogs] })),
  saveConversation: async () => {
    const { profile, conversation } = useAppStore.getState();
    if (!profile) {
      return;
    }

    try {
      const { error } = await supabase
        .from("users")
        .update({ coach_conversation: JSON.stringify(conversation) })
        .eq("id", profile.id);

      if (error) {
        console.log("[store] saveConversation skipped", error.message);
        const message = error.message.toLowerCase();
        if (
          message.includes("coach_conversation") ||
          message.includes("column") ||
          message.includes("schema cache")
        ) {
          return;
        }
      }
    } catch (error) {
      console.log(
        "[store] saveConversation failed",
        error instanceof Error ? error.message : String(error)
      );
    }
  },
  loadConversation: async () => {
    const { profile } = useAppStore.getState();
    if (!profile) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("coach_conversation")
        .eq("id", profile.id)
        .maybeSingle();

      if (error) {
        console.log("[store] loadConversation skipped", error.message);
        const message = error.message.toLowerCase();
        if (
          message.includes("coach_conversation") ||
          message.includes("column") ||
          message.includes("schema cache")
        ) {
          return;
        }
        return;
      }

      if (!data?.coach_conversation) {
        return;
      }

      const parsed = parseCoachConversation(data.coach_conversation);
      if (parsed) {
        set({
          conversation: parsed,
        });
      }
    } catch (error) {
      console.log(
        "[store] loadConversation failed",
        error instanceof Error ? error.message : String(error)
      );
    }
  },
  getFrequentFoods: (mealType, limit = 3) => {
    const mealFoods = useAppStore
      .getState()
      .foodLogs.filter((item) => item.mealType === mealType);

    const byFoodName = new Map<
      string,
      { count: number; latestLoggedAt: string; sample: FoodLog }
    >();

    mealFoods.forEach((item) => {
      const key = item.foodName.trim().toLowerCase();
      const existing = byFoodName.get(key);
      if (!existing) {
        byFoodName.set(key, {
          count: 1,
          latestLoggedAt: item.loggedAt,
          sample: item,
        });
        return;
      }

      const nextLatest =
        new Date(item.loggedAt).getTime() > new Date(existing.latestLoggedAt).getTime()
          ? item.loggedAt
          : existing.latestLoggedAt;

      byFoodName.set(key, {
        count: existing.count + 1,
        latestLoggedAt: nextLatest,
        sample:
          new Date(item.loggedAt).getTime() > new Date(existing.sample.loggedAt).getTime()
            ? item
            : existing.sample,
      });
    });

    const frequentFoods = Array.from(byFoodName.values())
      .filter((entry) => entry.count >= 2)
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return new Date(right.latestLoggedAt).getTime() - new Date(left.latestLoggedAt).getTime();
      })
      .slice(0, limit)
      .map((entry) => entry.sample);

    return frequentFoods.length >= 2 ? frequentFoods : [];
  },
  addCoachMessage: (message) => {
    set((state) => ({ conversation: [...state.conversation, message] }));
    void useAppStore.getState().saveConversation();
  },
  deleteCoachMessage: (timestamp, index) => {
    set((state) => ({
      conversation: state.conversation.filter((_, i) => i !== index),
    }));
    void useAppStore.getState().saveConversation();
  },
  clearConversation: () => {
    set((state) => ({
      conversation: [],
      conversationResetCount: state.conversationResetCount + 1,
    }));
    void useAppStore.getState().saveConversation();
  },
});

export const useAppStore: UseBoundStore<StoreApi<AppState>> = create<AppState>(appStateCreator);
