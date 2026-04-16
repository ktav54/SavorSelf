import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import type { FoodSource } from "@/types/models";

export interface FoodSearchResult {
  id: string;
  source: Exclude<FoodSource, "custom">;
  description: string;
  subtitle?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  isBranded: boolean;
}

function roundNutrition(value: number) {
  return Math.round(Number(value ?? 0));
}

export async function searchFoodCatalog(query: string): Promise<FoodSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `nutrition facts for: ${trimmedQuery}`,
      history: [],
      context: {},
      mode: "nutrition_lookup",
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? `Unable to look up nutrition (${response.status}).`);
  }

  const item = payload?.intent === "food_log" && Array.isArray(payload?.items) ? payload.items[0] : null;
  if (!item) {
    return [];
  }

  return [
    {
      id: `${item.name ?? trimmedQuery}-${item.quantity ?? 1}-${item.unit ?? "serving"}`,
      source: (item.foodSource ?? "ai_estimate") as Exclude<FoodSource, "custom">,
      description: item.name ?? trimmedQuery,
      subtitle: item.portion ?? "AI nutrition lookup",
      caloriesPer100g: roundNutrition(item.calories),
      proteinPer100g: roundNutrition(item.protein),
      carbsPer100g: roundNutrition(item.carbs),
      fatPer100g: roundNutrition(item.fat),
      isBranded: false,
    },
  ];
}
