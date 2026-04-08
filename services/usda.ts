import Constants from "expo-constants";
import { searchOpenFoodFactsProducts } from "@/services/openFoodFacts";
import type { FoodSource } from "@/types/models";

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

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

function getUsdaApiKey() {
  const runtimeValue =
    process.env.EXPO_PUBLIC_USDA_API_KEY ??
    Constants.expoConfig?.extra?.usdaApiKey ??
    "";

  return runtimeValue.trim();
}

function getNutrientValue(food: any, preferredNames: string[], preferredNumbers: string[]) {
  const matched = (food.foodNutrients ?? []).find((item: any) => {
    const nutrientName = item.nutrientName ?? item.nutrient?.name ?? "";
    const nutrientNumber = String(item.nutrientNumber ?? item.nutrient?.number ?? "");

    return preferredNames.includes(nutrientName) || preferredNumbers.includes(nutrientNumber);
  });

  return Number(matched?.value ?? 0);
}

function roundNutrition(value: number) {
  return Math.round(Number(value ?? 0));
}

function looksLikePackagedFood(query: string) {
  return /\b(bar|bars|chips|cracker|cookies?|cereal|soda|cola|drink|protein|shake|granola|frozen|brand)\b/i.test(
    query
  );
}

export async function searchUsdaFoods(query: string): Promise<FoodSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const apiKey = getUsdaApiKey();
  if (!apiKey) {
    throw new Error("USDA API key is missing. Set EXPO_PUBLIC_USDA_API_KEY before searching.");
  }

  const searchUrl =
    `${USDA_BASE_URL}/foods/search` +
    `?query=${encodeURIComponent(trimmedQuery)}` +
    `&pageSize=10` +
    `&api_key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(searchUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Unable to search USDA foods (${response.status}). ${errorText || "Check your API key and network connection."}`
    );
  }

  const payload = await response.json();
  const foods = Array.isArray(payload.foods) ? payload.foods : [];

  return foods.map((food: any) => {
    return {
      id: String(food.fdcId),
      source: "usda",
      description: food.description ?? "Unnamed food",
      subtitle: food.brandOwner ? `${food.brandOwner}${food.dataType ? ` · ${food.dataType}` : ""}` : food.dataType,
      caloriesPer100g: roundNutrition(getNutrientValue(food, ["Energy"], ["1008"])),
      proteinPer100g: roundNutrition(getNutrientValue(food, ["Protein"], ["1003"])),
      carbsPer100g: roundNutrition(getNutrientValue(food, ["Carbohydrate, by difference"], ["1005"])),
      fatPer100g: roundNutrition(getNutrientValue(food, ["Total lipid (fat)"], ["1004"])),
      isBranded: Boolean(food.brandOwner),
    };
  });
}

export async function searchFoodCatalog(query: string): Promise<FoodSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const [usdaResults, offResults] = await Promise.all([
    searchUsdaFoods(trimmedQuery).catch(() => []),
    searchOpenFoodFactsProducts(trimmedQuery).catch(() => []),
  ]);

  const mappedOffResults: FoodSearchResult[] = offResults.map((item) => ({
    id: item.code,
    source: "open_food_facts",
    description: item.productName,
    subtitle: item.brands ? `${item.brands} · Open Food Facts` : "Open Food Facts",
    caloriesPer100g: item.caloriesPer100g,
    proteinPer100g: item.proteinPer100g,
    carbsPer100g: item.carbsPer100g,
    fatPer100g: item.fatPer100g,
    isBranded: item.isBranded,
  }));

  const preferPackaged = looksLikePackagedFood(trimmedQuery);
  const primary = preferPackaged ? mappedOffResults : usdaResults;
  const secondary = preferPackaged ? usdaResults : mappedOffResults;

  return [...primary, ...secondary].slice(0, 12);
}
