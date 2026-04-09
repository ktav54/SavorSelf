// supabase/functions/ai-coach/index.ts
// Unified coach — handles food logging, macro edits, and general chat in one AI call.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const USDA_API_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const JSON_HEADERS = { "Content-Type": "application/json" };

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type FoodUnit = "g" | "oz" | "ml" | "fl_oz" | "cup" | "serving" | "piece" | "tbsp" | "tsp";
type FoodSource = "usda" | "open_food_facts" | "ai_estimate";

interface FoodItem {
  name: string;
  portion: string;
  quantity: number;
  unit: FoodUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  foodSource: FoodSource;
  externalFoodId?: string;
}

interface MacroEdit {
  itemIndex: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  name?: string;
}

interface UnifiedResponse {
  intent: "food_log" | "macro_edit" | "chat" | "clarification";
  reply: string;
  mealType?: MealType;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  foodItems?: Array<{
    name: string;
    portion: string;
    quantity: number;
    unit: string;
  }>;
  macroEdit?: MacroEdit;
}

interface RequestPayload {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  context: Record<string, unknown>;
  pendingProposal?: {
    mealType: MealType;
    items: Array<{
      name: string;
      portion: string;
      quantity: number;
      unit: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
  } | null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function cleanJson(raw: string) {
  return raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
}

function roundNutrition(value: number) {
  return Math.round(Number(value ?? 0));
}

function resolveMealType(raw: string | undefined): MealType {
  if (raw === "breakfast" || raw === "lunch" || raw === "dinner" || raw === "snack") return raw;
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}

function normalizeUnit(unit: string | null): FoodUnit {
  const u = unit?.trim().toLowerCase() ?? "";
  if (["g", "gram", "grams"].includes(u)) return "g";
  if (["oz", "ounce", "ounces"].includes(u)) return "oz";
  if (["ml", "milliliter", "milliliters"].includes(u)) return "ml";
  if (["fl_oz", "fl oz", "fluid ounce", "fluid ounces"].includes(u)) return "fl_oz";
  if (["cup", "cups"].includes(u)) return "cup";
  if (["tbsp", "tablespoon", "tablespoons"].includes(u)) return "tbsp";
  if (["tsp", "teaspoon", "teaspoons"].includes(u)) return "tsp";
  if (["piece", "pieces", "item", "items", "slice", "slices", "egg", "eggs", "bar", "bars"].includes(u)) return "piece";
  return "serving";
}

function gramsPerUnit(unit: FoodUnit, foodName: string): number {
  const name = foodName.toLowerCase();
  const pieceWeight =
    name.includes("egg") ? 50 :
    name.includes("bread") || name.includes("toast") ? 30 :
    name.includes("wing") ? 90 :
    name.includes("donut") || name.includes("doughnut") ? 75 :
    name.includes("burger") || name.includes("patty") ? 130 :
    name.includes("nugget") ? 18 :
    name.includes("bar") ? 60 :
    50;

  const map: Record<FoodUnit, number> = {
    g: 1, oz: 28.3495, ml: 1, fl_oz: 29.5735,
    cup: 240, serving: 100, piece: pieceWeight, tbsp: 15, tsp: 5,
  };
  return map[unit];
}

function nutrientValue(food: any, names: string[], numbers: string[]): number {
  const matched = (food?.foodNutrients ?? []).find((item: any) => {
    const n = item.nutrientName ?? item.nutrient?.name ?? "";
    const num = String(item.nutrientNumber ?? item.nutrient?.number ?? "");
    return names.includes(n) || numbers.includes(num);
  });
  return Number(matched?.value ?? 0);
}

function offValue(product: any, key: string): number {
  return Number(product?.nutriments?.[key] ?? 0);
}

function looksPackaged(name: string): boolean {
  return /\b(bar|chips|cracker|cookie|cereal|soda|cola|protein|shake|granola|frozen)\b/i.test(name);
}

async function searchUsda(name: string, apiKey: string) {
  const res = await fetch(
    `${USDA_API_URL}?query=${encodeURIComponent(name)}&pageSize=1&api_key=${encodeURIComponent(apiKey)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.foods?.[0] ?? null;
}

async function searchOFF(name: string) {
  const res = await fetch(
    `${OPEN_FOOD_FACTS_URL}?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=1&fields=code,product_name,nutriments`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.products?.[0] ?? null;
}

async function estimateWithGroq(name: string, portion: string, apiKey: string) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      messages: [
        { role: "system", content: "Return valid JSON only. No markdown." },
        { role: "user", content: `Nutritional info for ${name} (${portion}). Return: {"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}` },
      ],
    }),
  });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(cleanJson(content)) as { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

async function enrichFoodItem(
  item: { name: string; portion: string; quantity: number; unit: string },
  usdaApiKey: string,
  groqApiKey: string
): Promise<FoodItem> {
  const unit = normalizeUnit(item.unit);
  const quantity = item.quantity > 0 ? item.quantity : 1;
  const grams = gramsPerUnit(unit, item.name);
  const multiplier = (quantity * grams) / 100;

  const [usdaFood, offFood] = await Promise.all([
    searchUsda(item.name, usdaApiKey),
    searchOFF(item.name).catch(() => null),
  ]);

  if (!usdaFood && !offFood) {
    const est = await estimateWithGroq(item.name, item.portion || `${quantity} ${unit}`, groqApiKey);
    return {
      name: item.name,
      portion: item.portion || `${quantity} ${unit}`,
      quantity,
      unit,
      calories: roundNutrition(est.calories),
      protein: roundNutrition(est.protein_g),
      carbs: roundNutrition(est.carbs_g),
      fat: roundNutrition(est.fat_g),
      fiber: 0,
      sugar: 0,
      foodSource: "ai_estimate",
    };
  }

  const useOFF = looksPackaged(item.name) && offFood;
  const source: FoodSource = useOFF ? "open_food_facts" : usdaFood ? "usda" : "open_food_facts";
  const food = source === "usda" ? usdaFood : offFood;

  const cal = source === "usda" ? nutrientValue(food, ["Energy"], ["1008"]) : offValue(food, "energy-kcal_100g");
  const pro = source === "usda" ? nutrientValue(food, ["Protein"], ["1003"]) : offValue(food, "proteins_100g");
  const carb = source === "usda" ? nutrientValue(food, ["Carbohydrate, by difference"], ["1005"]) : offValue(food, "carbohydrates_100g");
  const fat = source === "usda" ? nutrientValue(food, ["Total lipid (fat)"], ["1004"]) : offValue(food, "fat_100g");
  const fiber = source === "usda" ? nutrientValue(food, ["Fiber, total dietary"], ["1079"]) : offValue(food, "fiber_100g");
  const sugar = source === "usda" ? nutrientValue(food, ["Sugars, total including NLEA"], ["2000"]) : offValue(food, "sugars_100g");
  const description = source === "usda" ? (food?.description ?? item.name) : (food?.product_name ?? item.name);
  const externalFoodId = source === "usda" ? String(food?.fdcId ?? "") : String(food?.code ?? "");

  return {
    name: description,
    portion: item.portion || `${quantity} ${unit}`,
    quantity,
    unit,
    calories: roundNutrition(cal * multiplier),
    protein: roundNutrition(pro * multiplier),
    carbs: roundNutrition(carb * multiplier),
    fat: roundNutrition(fat * multiplier),
    fiber: roundNutrition(fiber * multiplier),
    sugar: roundNutrition(sugar * multiplier),
    foodSource: source,
    externalFoodId,
  };
}

const SYSTEM_PROMPT = `You are the SavorSelf Coach — a calm, warm wellness companion with deep knowledge of nutritional psychiatry, gut-brain science, and behavioral psychology. You speak like a thoughtful friend, never preachy or clinical.

You handle three things in one conversation without ever breaking flow:
1. Food logging — when the user mentions eating something
2. Macro corrections — when the user tells you specific nutrition info for something
3. General wellness chat — mood, energy, patterns, questions, emotional support

INTENT DETECTION — return one of these intents in your JSON:
- "food_log": user is describing food they ate or want to log. Extract food items with portions.
- "macro_edit": user is correcting nutrition data for a food already in the pending proposal (e.g. "the bar is actually 230 cal 20g protein", "change the name to Think Bar"). Extract which item (by index, 0-based) and what to change.
- "clarification": you need ONE piece of info to log accurately. Only use this if truly impossible to estimate.
- "chat": anything else — questions, feelings, mood, general conversation.

FOOD LOGGING RULES:
- Be aggressive about assumptions. Never ask about obvious ingredients.
- Defaults: chicken nuggets = 6 pieces, burger = 1 with bun, mcdouble = 2 patties with bun, pizza = 1 slice, eggs = large, coffee = 8oz, sandwich = 1 standard, fries = medium, wings = 6 pieces, rice = 1 cup cooked, pasta = 1 cup cooked, protein bar = 1 bar.
- Only ask ONE clarifying question total, only when truly impossible to estimate.
- Units must be one of: g, oz, ml, fl_oz, cup, serving, piece, tbsp, tsp.

MACRO EDIT RULES:
- If the user says something like "it's 230 cal", "20g protein", "the name is Think Bar", "change calories to 400" — this is a macro_edit.
- itemIndex is 0 if there's only one item, otherwise figure out which item they mean from context.
- Only include the fields they mentioned (calories, protein, carbs, fat, name). Don't invent others.

COACH PERSONALITY:
- Never shame. Show grace always. Food guilt is real and harmful — never reinforce it.
- Speak plainly. No jargon unless the user wants depth.
- Ask one question at a time. Keep responses concise unless the user wants to go deeper.
- Never claim you logged something. Only the user can confirm a log by tapping "Confirm and log."
- If asked if something was logged, say they need to tap "Confirm and log" to save it.
- Use their mood/food/journal data to make responses feel personal. Frame observations as curiosity: "I noticed..." not "You should..."
- If someone expresses distress, acknowledge warmly first. Suggest professional help gently if serious.

GUT-BRAIN SCIENCE YOU KNOW DEEPLY:
- 90-95% of serotonin is produced in the gut. Fiber, fermented foods, and microbiome diversity directly affect mood.
- Omega-3s (salmon, sardines, walnuts, flax) reduce neuroinflammation and support mood.
- Blood sugar spikes and crashes cause irritability, brain fog, and anxiety. Protein and fiber stabilize this.
- Magnesium deficiency is common and linked to anxiety, poor sleep, and low mood.
- Caffeine within 90 minutes of waking spikes cortisol. After 2pm disrupts sleep even if you fall asleep easily.
- Poor sleep increases neuroinflammation and directly worsens mood and cognition.
- Ultra-processed food is linked to higher rates of depression and anxiety in large cohort studies.
- Even a 20-minute walk stimulates BDNF which promotes neuroplasticity and reduces depression.

RESPONSE FORMAT — always return valid JSON only, no markdown:
{
  "intent": "food_log" | "macro_edit" | "chat" | "clarification",
  "reply": "your warm conversational response here",
  "mealType": "breakfast|lunch|dinner|snack or null",
  "needsClarification": true|false,
  "clarificationQuestion": "string or null",
  "foodItems": [
    {"name": "string", "portion": "string", "quantity": number, "unit": "string"}
  ] or null,
  "macroEdit": {
    "itemIndex": number,
    "calories": number or null,
    "protein": number or null,
    "carbs": number or null,
    "fat": number or null,
    "name": "string or null"
  } or null
}`;

Deno.serve(async (request: Request) => {
  console.log("[ai-coach] invoked");

  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const payload = (await request.json()) as RequestPayload;
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const usdaApiKey = Deno.env.get("USDA_API_KEY") ?? Deno.env.get("EXPO_PUBLIC_USDA_API_KEY");

    if (!groqApiKey) {
      return jsonResponse({ intent: "chat", reply: "GROQ_API_KEY is not configured." });
    }

    if (!usdaApiKey) {
      return jsonResponse({ intent: "chat", reply: "USDA_API_KEY is not configured." });
    }

    // Build messages for Groq
    const systemMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `User context: ${JSON.stringify({
          moodLogs: payload.context?.moodLogs,
          foodSummary: payload.context?.foodSummary,
          journalEntries: payload.context?.journalEntries,
          insights: payload.context?.insights,
        })}`,
      },
    ];

    if (payload.pendingProposal) {
      systemMessages.push({
        role: "system",
        content: `There is currently a pending food proposal the user has not yet confirmed: ${JSON.stringify(payload.pendingProposal)}. If the user is editing macros or the name, use intent "macro_edit".`,
      });
    }

    // Filter history to avoid sending huge food proposal blobs
    const filteredHistory = (payload.history ?? [])
      .filter((m) => m.content.length < 400)
      .slice(-10); // last 10 messages max

    const messages = [
      ...systemMessages,
      ...filteredHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: payload.message },
    ];

    console.log("[ai-coach] calling Groq, history length:", filteredHistory.length);

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        messages,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.log("[ai-coach] Groq error", err);
      return jsonResponse({ intent: "chat", reply: "I hit a snag. Please try again." }, 500);
    }

    const groqData = await groqRes.json();
    const raw = groqData?.choices?.[0]?.message?.content ?? "";
    console.log("[ai-coach] raw response", raw);

    let parsed: UnifiedResponse;
    try {
      parsed = JSON.parse(cleanJson(raw));
    } catch {
      // If JSON parsing fails, treat as chat
      return jsonResponse({ intent: "chat", reply: raw || "I'm here with you." });
    }

    // Handle food_log intent — enrich with real nutrition data
    if (parsed.intent === "food_log" && parsed.foodItems?.length) {
      console.log("[ai-coach] enriching food items", parsed.foodItems.length);

      const enrichedItems = await Promise.all(
        parsed.foodItems.map((item) => enrichFoodItem(item, usdaApiKey, groqApiKey))
      );

      return jsonResponse({
        intent: "food_log",
        reply: parsed.reply,
        mealType: resolveMealType(parsed.mealType ?? undefined),
        items: enrichedItems,
      });
    }

    // Handle macro_edit intent
    if (parsed.intent === "macro_edit" && parsed.macroEdit) {
      return jsonResponse({
        intent: "macro_edit",
        reply: parsed.reply,
        macroEdit: parsed.macroEdit,
      });
    }

    // Handle clarification
    if (parsed.intent === "clarification" || parsed.needsClarification) {
      return jsonResponse({
        intent: "clarification",
        reply: parsed.clarificationQuestion ?? parsed.reply,
      });
    }

    // Default: chat
    return jsonResponse({
      intent: "chat",
      reply: parsed.reply || "I'm here with you.",
    });

  } catch (error) {
    console.log("[ai-coach] error", error);
    return jsonResponse(
      { intent: "chat", reply: error instanceof Error ? error.message : "Something went wrong. Please try again." },
      500
    );
  }
});
