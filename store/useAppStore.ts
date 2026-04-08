import { endOfDay, startOfDay } from "date-fns";
import { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { analyzeFoodMood } from "@/lib/food-mood";
import { demoConversation, demoInsights, demoJournalEntries, demoQuickLogs } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
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
  JournalEntry,
  MoodLog,
  QuickLog,
  UserProfile,
} from "@/types/models";

interface AppState {
  sessionReady: boolean;
  isAuthenticated: boolean;
  authUser: User | null;
  profile: UserProfile | null;
  moodLogs: MoodLog[];
  foodLogs: FoodLog[];
  quickLogs: QuickLog[];
  journalEntries: JournalEntry[];
  insights: FoodMoodInsight[];
  foodMoodSnapshot: FoodMoodSnapshot | null;
  foodMoodTrend: FoodMoodTrendPoint[];
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
  journalLoading: boolean;
  journalError: string | null;
  initializeAuth: () => Promise<void>;
  handleSessionChange: (session: Session | null) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (payload: { email: string; password: string; name?: string }) => Promise<{ error?: string }>;
  completeOnboarding: (details: Partial<UserProfile>) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  loadTodayMoodLog: () => Promise<void>;
  loadTodayFoodLogs: () => Promise<void>;
  loadFoodMoodInsights: () => Promise<void>;
  loadJournalEntries: () => Promise<void>;
  saveMoodLog: (input: Omit<MoodLog, "id" | "userId" | "loggedAt">) => Promise<{ error?: string }>;
  saveJournalEntry: (input: { body: string; promptUsed?: string }) => Promise<{ error?: string }>;
  saveFoodLog: (input: {
    foodName: string;
    foodSource?: Exclude<FoodSource, "custom">;
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
    foodSource?: Exclude<FoodSource, "custom">;
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
  addMoodLog: (log: MoodLog) => void;
  addFoodLog: (log: FoodLog) => void;
  addQuickLog: (log: QuickLog) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  addCoachMessage: (message: AiConversationMessage) => void;
  clearConversation: () => void;
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
    dailyWaterGoal: row.daily_water_goal ?? undefined,
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

function mapJournalEntry(row: any): JournalEntry {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    promptUsed: row.prompt_used ?? undefined,
    body: row.body,
    isGraceMode: Boolean(row.is_grace_mode),
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

export const useAppStore = create<AppState>((set) => ({
  sessionReady: false,
  isAuthenticated: false,
  authUser: null,
  profile: null,
  moodLogs: [],
  foodLogs: [],
  quickLogs: demoQuickLogs,
  journalEntries: demoJournalEntries,
  insights: demoInsights,
  foodMoodSnapshot: null,
  foodMoodTrend: [],
  conversation: demoConversation,
  conversationResetCount: 0,
  authError: null,
  authLoading: false,
  moodLoading: false,
  moodError: null,
  foodLoading: false,
  foodError: null,
  insightsLoading: false,
  insightsError: null,
  journalLoading: false,
  journalError: null,
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
        journalEntries: [],
        insights: [],
        foodMoodSnapshot: null,
        foodMoodTrend: [],
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

      await useAppStore.getState().loadTodayMoodLog();
      await useAppStore.getState().loadTodayFoodLogs();
      await useAppStore.getState().loadJournalEntries();
      await useAppStore.getState().loadFoodMoodInsights();
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

    const { data, error } = await supabase
      .from("users")
      .update({
        name: nextProfile.name,
        preferred_units: nextProfile.preferredUnits,
        onboarding_complete: true,
        daily_calorie_goal: nextProfile.dailyCalorieGoal ?? null,
        daily_protein_goal: nextProfile.dailyProteinGoal ?? null,
        daily_water_goal: nextProfile.dailyWaterGoal ?? null,
      })
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error) {
      set({
        profile,
      });
      return { error: error.message };
    }

    set({
      profile: mapProfile(data),
    });

    return {};
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({
      isAuthenticated: false,
      authUser: null,
      profile: null,
      moodLogs: [],
      foodLogs: [],
      journalEntries: [],
      conversation: [],
      conversationResetCount: 0,
      authError: null,
    });
  },
  loadTodayMoodLog: async () => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return;
    }

    set({
      moodLoading: true,
      moodError: null,
    });

    const start = startOfDay(new Date()).toISOString();
    const end = endOfDay(new Date()).toISOString();

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
  },
  loadTodayFoodLogs: async () => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return;
    }

    set({
      foodLoading: true,
      foodError: null,
    });

    const start = startOfDay(new Date()).toISOString();
    const end = endOfDay(new Date()).toISOString();

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

    const moodLogs = (moodData ?? []).map(mapMoodLog);
    const foodLogs = (foodData ?? []).map(mapFoodLog);
    const quickLogs = (quickData ?? []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      loggedAt: row.logged_at,
      waterOz: row.water_oz ?? undefined,
      caffeineMg: row.caffeine_mg ?? undefined,
      steps: row.steps ?? undefined,
      sleepHours: row.sleep_hours ?? undefined,
      exerciseMinutes: row.exercise_minutes ?? undefined,
      exerciseType: row.exercise_type ?? undefined,
    }));

    const analysis = analyzeFoodMood({
      userId: profile.id,
      moodLogs,
      foodLogs,
      quickLogs,
    });

    set({
      quickLogs,
      insights: analysis.insights,
      foodMoodSnapshot: analysis.snapshot,
      foodMoodTrend: analysis.trend,
      insightsLoading: false,
      insightsError: null,
    });
  },
  loadJournalEntries: async () => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return;
    }

    set({
      journalLoading: true,
      journalError: null,
    });

    const since = new Date();
    since.setDate(since.getDate() - 60);

    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", profile.id)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      set({
        journalLoading: false,
        journalError: error.message,
      });
      return;
    }

    set({
      journalEntries: (data ?? []).map(mapJournalEntry),
      journalLoading: false,
      journalError: null,
    });
  },
  saveMoodLog: async (input) => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    set({
      moodLoading: true,
      moodError: null,
    });

    const start = startOfDay(new Date()).toISOString();
    const end = endOfDay(new Date()).toISOString();

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
      logged_at: new Date().toISOString(),
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
  saveJournalEntry: async (input) => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    if (!input.body.trim()) {
      return { error: "Write a little before saving your entry." };
    }

    set({
      journalLoading: true,
      journalError: null,
    });

    const start = startOfDay(new Date()).toISOString();
    const end = endOfDay(new Date()).toISOString();

    const { data: existing, error: existingError } = await supabase
      .from("journal_entries")
      .select("id")
      .eq("user_id", profile.id)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      set({
        journalLoading: false,
        journalError: existingError.message,
      });
      return { error: existingError.message };
    }

    const payload = {
      user_id: profile.id,
      created_at: new Date().toISOString(),
      prompt_used: input.promptUsed ?? null,
      body: input.body.trim(),
      is_grace_mode: false,
    };

    const query = existing?.id
      ? supabase.from("journal_entries").update(payload).eq("id", existing.id).select("*").single()
      : supabase.from("journal_entries").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error) {
      set({
        journalLoading: false,
        journalError: error.message,
      });
      return { error: error.message };
    }

    const savedEntry = mapJournalEntry(data);

    set((state) => ({
      journalEntries: [
        savedEntry,
        ...state.journalEntries.filter((entry) => entry.id !== savedEntry.id),
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      journalLoading: false,
      journalError: null,
    }));

    return {};
  },
  saveFoodLog: async (input) => {
    const profile = useAppStore.getState().profile;
    if (!profile) {
      return { error: "You need to be signed in first." };
    }

    set({
      foodLoading: true,
      foodError: null,
    });

    const payload = {
      user_id: profile.id,
      logged_at: new Date().toISOString(),
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
      logged_at: new Date().toISOString(),
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
  addMoodLog: (log) => set((state) => ({ moodLogs: [log, ...state.moodLogs] })),
  addFoodLog: (log) => set((state) => ({ foodLogs: [log, ...state.foodLogs] })),
  addQuickLog: (log) => set((state) => ({ quickLogs: [log, ...state.quickLogs] })),
  addJournalEntry: (entry) =>
    set((state) => ({ journalEntries: [entry, ...state.journalEntries] })),
  addCoachMessage: (message) =>
    set((state) => ({ conversation: [...state.conversation, message] })),
  clearConversation: () =>
    set((state) => ({
      conversation: [],
      conversationResetCount: state.conversationResetCount + 1,
    })),
}));
