type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type FoodUnit = "g" | "oz" | "ml" | "fl_oz" | "cup" | "serving" | "piece" | "tbsp" | "tsp";
type FoodSource = "usda" | "open_food_facts" | "ai_estimate";

interface ParsedFoodCandidate {
  name: string;
  portion?: string;
  quantity: number | null;
  unit: string | null;
  needsClarification: boolean;
  clarificationReason: string | null;
}

interface ParseResponse {
  isFoodLogging: boolean;
  needsClarification: boolean;
  question?: string;
  mealType?: MealType;
  items: ParsedFoodCandidate[];
}

interface FoodParserPayload {
  message: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  pendingProposal?: {
    mealType: MealType;
    needsClarification: boolean;
    clarificationQuestion?: string;
    items: Array<{
      name: string;
      foodSource?: FoodSource;
      externalFoodId?: string;
      quantity: number;
      unit: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      fiberG?: number;
      sugarG?: number;
    }>;
    sourceMessage: string;
  } | null;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const USDA_API_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const JSON_HEADERS = { "Content-Type": "application/json" };

const SYSTEM_PROMPT =
  'You help users log food conversationally. Extract foods, portions, quantity, unit, and meal type from the user message and prior conversation context. Never estimate or invent calories, protein, carbs, fat, fiber, or sugar. Those values will be looked up later from real food databases, so focus only on identifying foods and the most plausible portion details. Make reasonable assumptions for common foods and default compositions: burgers, sandwiches, tacos, burritos, pizza, pasta, salads, coffee drinks, eggs, toast, rice bowls, and similar everyday meals should be inferred without asking about obvious ingredients unless the user says they were unusual. Ask at most one clarifying question per food item, and only when the portion is truly too vague to log responsibly. Do not repeat questions the user already answered in the conversation history. You must return unit values using only one of these exact strings: g, oz, ml, fl_oz, cup, serving, piece, tbsp, tsp. If the user says item, treat that as piece. You must respond with valid JSON only. No markdown, no explanation, just raw JSON. Return exactly this schema: {"isFoodLogging": true|false, "needsClarification": true|false, "question": "string when clarification is needed", "mealType": "breakfast|lunch|dinner|snack when known", "items": [{"name":"string","portion":"string","quantity":number,"unit":"g|oz|ml|fl_oz|cup|serving|piece|tbsp|tsp","needsClarification":boolean,"clarificationReason":"string or null"}]}.';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function resolveMealType(parsedMealType: string): MealType {
  if (
    parsedMealType === "breakfast" ||
    parsedMealType === "lunch" ||
    parsedMealType === "dinner" ||
    parsedMealType === "snack"
  ) {
    return parsedMealType;
  }

  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}

function defaultQuantity(quantity: number | null) {
  return quantity && quantity > 0 ? quantity : 1;
}

function normalizeUnit(unit: string | null): FoodUnit {
  const normalized = unit?.trim().toLowerCase() ?? "";

  if (["g", "gram", "grams"].includes(normalized)) return "g";
  if (["oz", "ounce", "ounces"].includes(normalized)) return "oz";
  if (["ml", "milliliter", "milliliters"].includes(normalized)) return "ml";
  if (["fl_oz", "fl oz", "fluid ounce", "fluid ounces"].includes(normalized)) return "fl_oz";
  if (["cup", "cups"].includes(normalized)) return "cup";
  if (["tbsp", "tablespoon", "tablespoons"].includes(normalized)) return "tbsp";
  if (["tsp", "teaspoon", "teaspoons"].includes(normalized)) return "tsp";
  if (["serving", "servings"].includes(normalized)) return "serving";
  if (["piece", "pieces", "item", "items", "slice", "slices", "egg", "eggs"].includes(normalized)) return "piece";

  return "serving";
}

function gramsPerUnit(unit: FoodUnit, foodName: string) {
  const lowerName = foodName.toLowerCase();
  const pieceWeight =
    lowerName.includes("egg")
      ? 50
      : lowerName.includes("bread") || lowerName.includes("toast")
        ? 30
        : lowerName.includes("wing")
          ? 90
          : lowerName.includes("donut") || lowerName.includes("doughnut")
            ? 75
            : lowerName.includes("burger patty") || lowerName.includes("patty")
              ? 100
              : 50;

  const map: Record<FoodUnit, number> = {
    g: 1,
    oz: 28.3495,
    ml: 1,
    fl_oz: 29.5735,
    cup: 240,
    serving: 100,
    piece: pieceWeight,
    tbsp: 15,
    tsp: 5,
  };

  return map[unit];
}

function nutrientValue(food: any, names: string[], numbers: string[]) {
  const matched = (food?.foodNutrients ?? []).find((item: any) => {
    const nutrientName = item.nutrientName ?? item.nutrient?.name ?? "";
    const nutrientNumber = String(item.nutrientNumber ?? item.nutrient?.number ?? "");
    return names.includes(nutrientName) || numbers.includes(nutrientNumber);
  });

  return Number(matched?.value ?? 0);
}

function openFoodFactsValue(product: any, key: string) {
  return Number(product?.nutriments?.[key] ?? 0);
}

function cleanJsonResponse(raw: string) {
  return raw
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();
}

function looksLikePackagedFood(name: string) {
  return /\b(bar|chips|cracker|cookies?|cereal|soda|cola|protein|shake|granola|frozen)\b/i.test(
    name
  );
}

function roundNutrition(value: number) {
  return Math.round(Number(value ?? 0));
}

async function searchUsdaFood(name: string, usdaApiKey: string) {
  console.log("[ai-food-parser] USDA search", name);

  const response = await fetch(
    `${USDA_API_URL}?query=${encodeURIComponent(name)}&pageSize=1&api_key=${encodeURIComponent(usdaApiKey)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`USDA lookup failed for ${name}: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.foods) ? payload.foods[0] ?? null : null;
}

async function searchOpenFoodFactsProduct(name: string) {
  console.log("[ai-food-parser] Open Food Facts search", name);

  const response = await fetch(
    `${OPEN_FOOD_FACTS_SEARCH_URL}?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=1&fields=code,product_name,brands,brands_tags,nutriments`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Open Food Facts lookup failed for ${name}: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.products) ? payload.products[0] ?? null : null;
}

async function parseWithGroq(
  message: string,
  history: FoodParserPayload["history"],
  pendingProposal: FoodParserPayload["pendingProposal"],
  apiKey: string
) {
  console.log("[ai-food-parser] calling Groq");

  const normalizedHistory = history ?? [];
  const lastHistoryEntry = normalizedHistory[normalizedHistory.length - 1];
  const historyAlreadyIncludesLatestMessage =
    lastHistoryEntry?.role === "user" && lastHistoryEntry.content.trim() === message.trim();

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    pendingProposal
      ? {
          role: "system",
          content: `Existing draft proposal to revise: ${JSON.stringify(pendingProposal)}`,
        }
      : null,
    ...normalizedHistory.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    !historyAlreadyIncludesLatestMessage
      ? {
          role: "user",
          content: message,
        }
      : null,
  ].filter(Boolean);

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq parsing request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  console.log("[ai-food-parser] raw Groq response", content);

  if (!content) {
    throw new Error("Groq returned an empty parsing response.");
  }

  return JSON.parse(cleanJsonResponse(content)) as ParseResponse;
}

async function estimateNutritionWithGroq(food: string, portion: string, apiKey: string) {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You must respond with valid JSON only. No markdown, no explanation, just raw JSON.",
        },
        {
          role: "user",
          content: `Provide nutritional info per serving for ${food}${portion ? ` (${portion})` : ""}: calories, protein_g, carbs_g, fat_g. Return JSON only.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq nutrition estimate failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  console.log("[ai-food-parser] raw Groq estimate response", content);

  if (!content) {
    throw new Error("Groq returned an empty nutrition estimate.");
  }

  return JSON.parse(cleanJsonResponse(content)) as {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}

Deno.serve(async (request: Request) => {
  console.log("[ai-food-parser] function invoked");

  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const payload = (await request.json()) as FoodParserPayload;
    console.log("[ai-food-parser] payload received", {
      hasMessage: Boolean(payload?.message),
      historyCount: payload?.history?.length ?? 0,
      hasPendingProposal: Boolean(payload?.pendingProposal),
    });

    if (!payload?.message?.trim()) {
      return jsonResponse({
        isFoodLogging: false,
        needsClarification: false,
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const usdaApiKey = Deno.env.get("USDA_API_KEY") ?? Deno.env.get("EXPO_PUBLIC_USDA_API_KEY");

    console.log("[ai-food-parser] env check", {
      hasGroqKey: Boolean(groqApiKey),
      hasUsdaKey: Boolean(usdaApiKey),
    });

    if (!groqApiKey) {
      return jsonResponse({
        isFoodLogging: false,
        needsClarification: false,
        question: "The food parser is wired up, but GROQ_API_KEY is not configured yet.",
      });
    }

    if (!usdaApiKey) {
      return jsonResponse({
        isFoodLogging: false,
        needsClarification: false,
        question: "The food parser needs a USDA_API_KEY secret before it can estimate nutrition.",
      });
    }

    const parsed = await parseWithGroq(
      payload.message,
      payload.history ?? [],
      payload.pendingProposal ?? null,
      groqApiKey
    );

    console.log("[ai-food-parser] Groq parse complete", {
      isFoodLogging: parsed.isFoodLogging,
      needsClarification: parsed.needsClarification,
      itemCount: parsed.items?.length ?? 0,
    });

    if (!parsed.isFoodLogging) {
      return jsonResponse({ isFoodLogging: false, needsClarification: false });
    }

    if (parsed.needsClarification || parsed.items.some((item) => item.needsClarification)) {
      const firstUnclearItem = parsed.items.find((item) => item.needsClarification);

      return jsonResponse({
        isFoodLogging: true,
        needsClarification: true,
        question:
          parsed.question ??
          firstUnclearItem?.clarificationReason ??
          "Could you tell me a little more about the portion so I can log it accurately?",
      });
    }

    const enrichedItems = [];

    for (const item of parsed.items) {
      const [usdaFood, openFoodFactsFood] = await Promise.all([
        searchUsdaFood(item.name, usdaApiKey),
        searchOpenFoodFactsProduct(item.name).catch((error) => {
          console.log("[ai-food-parser] Open Food Facts lookup error", error);
          return null;
        }),
      ]);

      const quantity = defaultQuantity(item.quantity);
      const unit = normalizeUnit(item.unit);
      const gramsForUnit = gramsPerUnit(unit, item.name);
      const multiplier = (quantity * gramsForUnit) / 100;

      if (!usdaFood && !openFoodFactsFood) {
        const estimate = await estimateNutritionWithGroq(
          item.name,
          item.portion?.trim() || `${quantity} ${unit}`,
          groqApiKey
        );

        enrichedItems.push({
          name: item.name,
          foodSource: "ai_estimate",
          portion: item.portion?.trim() || `${quantity} ${unit}`,
          externalFoodId: undefined,
          quantity,
          unit,
          calories: roundNutrition(estimate.calories),
          protein: roundNutrition(estimate.protein_g),
          carbs: roundNutrition(estimate.carbs_g),
          fat: roundNutrition(estimate.fat_g),
          fiber: 0,
          sugar: 0,
        });
        continue;
      }

      const preferPackaged = looksLikePackagedFood(item.name);
      const chosenSource: FoodSource =
        preferPackaged && openFoodFactsFood ? "open_food_facts" : usdaFood ? "usda" : "open_food_facts";

      const description =
        chosenSource === "usda"
          ? usdaFood?.description ?? item.name
          : openFoodFactsFood?.product_name ?? item.name;
      const externalFoodId =
        chosenSource === "usda"
          ? String(usdaFood?.fdcId ?? "")
          : String(openFoodFactsFood?.code ?? "");

      const per100Calories =
        chosenSource === "usda"
          ? nutrientValue(usdaFood, ["Energy"], ["1008"])
          : openFoodFactsValue(openFoodFactsFood, "energy-kcal_100g");
      const per100Protein =
        chosenSource === "usda"
          ? nutrientValue(usdaFood, ["Protein"], ["1003"])
          : openFoodFactsValue(openFoodFactsFood, "proteins_100g");
      const per100Carbs =
        chosenSource === "usda"
          ? nutrientValue(usdaFood, ["Carbohydrate, by difference"], ["1005"])
          : openFoodFactsValue(openFoodFactsFood, "carbohydrates_100g");
      const per100Fat =
        chosenSource === "usda"
          ? nutrientValue(usdaFood, ["Total lipid (fat)"], ["1004"])
          : openFoodFactsValue(openFoodFactsFood, "fat_100g");
      const per100Fiber =
        chosenSource === "usda"
          ? nutrientValue(usdaFood, ["Fiber, total dietary"], ["1079"])
          : openFoodFactsValue(openFoodFactsFood, "fiber_100g");
      const per100Sugar =
        chosenSource === "usda"
          ? nutrientValue(usdaFood, ["Sugars, total including NLEA"], ["2000"])
          : openFoodFactsValue(openFoodFactsFood, "sugars_100g");

      console.log("[ai-food-parser] food match", {
        requestedName: item.name,
        chosenSource,
        matchedDescription: description,
        externalFoodId,
        quantity,
        unit,
        gramsPerUnit: gramsForUnit,
        multiplier,
        per100Calories,
      });

      enrichedItems.push({
        name: description,
        foodSource: chosenSource,
        portion: item.portion?.trim() || `${quantity} ${unit}`,
        externalFoodId,
        quantity,
        unit,
        calories: roundNutrition(per100Calories * multiplier),
        protein: roundNutrition(per100Protein * multiplier),
        carbs: roundNutrition(per100Carbs * multiplier),
        fat: roundNutrition(per100Fat * multiplier),
        fiber: roundNutrition(per100Fiber * multiplier),
        sugar: roundNutrition(per100Sugar * multiplier),
      });
    }

    console.log("[ai-food-parser] returning structured proposal", {
      mealType: parsed.mealType,
      itemCount: enrichedItems.length,
    });

    return jsonResponse({
      isFoodLogging: true,
      needsClarification: false,
      mealType: resolveMealType(parsed.mealType ?? "snack"),
      items: enrichedItems,
    });
  } catch (error) {
    console.log("[ai-food-parser] handler error", error);

    return jsonResponse(
      {
        isFoodLogging: false,
        needsClarification: false,
        question:
          error instanceof Error
            ? error.message
            : "Something went wrong while parsing that meal. Please try again.",
      },
      500
    );
  }
});
