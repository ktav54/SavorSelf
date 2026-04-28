// supabase/functions/ai-coach/index.ts
// Unified coach — handles food logging, macro edits, and general chat in one AI call.

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
  macroEdits?: MacroEdit[];
}

interface RequestPayload {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  context: Record<string, unknown>;
  mode?: string;
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

interface CoachMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

async function callAzureOpenAI(messages: CoachMessage[], apiKey: string, temperature = 0.7) {
  const azureEndpoint =
    Deno.env.get("AZURE_OPENAI_ENDPOINT") ??
    "https://kevin-mof0qwxf-eastus2.cognitiveservices.azure.com";
  const deploymentName = "gpt-4.1-mini";
  const apiVersion = "2024-12-01-preview";

  return fetch(
    `${azureEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
    {
    method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
    body: JSON.stringify({
      temperature,
        max_tokens: 1000,
      messages,
    }),
    }
  );
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
  if (["piece", "pieces", "item", "items", "slice", "slices", "egg", "eggs", "bar", "bars", "donut", "donuts"].includes(u)) return "piece";
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
  return /\b(bar|chips|cracker|cookie|cereal|soda|cola|protein|shake|granola|frozen|dunkin|starbucks|kind|clif|rxbar|think|quest)\b/i.test(name);
}

async function searchUsda(name: string, apiKey: string) {
  const res = await fetch(
    `${USDA_API_URL}?query=${encodeURIComponent(name)}&pageSize=3&api_key=${encodeURIComponent(apiKey)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  // Try to find best match — prefer branded/survey foods over raw ingredients
  const foods = data?.foods ?? [];
  const branded = foods.find((f: any) => f.dataType === "Branded");
  return branded ?? foods[0] ?? null;
}

async function searchOFF(name: string) {
  const res = await fetch(
    `${OPEN_FOOD_FACTS_URL}?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=3&fields=code,product_name,nutriments`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const products = data?.products ?? [];
  // Prefer products with actual nutriment data
  const withData = products.find((p: any) => p?.nutriments?.["energy-kcal_100g"]);
  return withData ?? products[0] ?? null;
}

async function estimateWithAzureOpenAI(name: string, portion: string, apiKey: string) {
  const res = await callAzureOpenAI(
    [
      { role: "system", content: "Return valid JSON only. No markdown. No explanation." },
      { role: "user", content: `Give accurate nutrition for ${name} (${portion}) as typically prepared and consumed. Black coffee = ~2 cal. Scrambled eggs = ~70 cal each. Be precise. Return only: {"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}` },
    ],
    apiKey,
    0.1
  );
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(cleanJson(content)) as { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

async function enrichFoodItem(
  item: { name: string; portion: string; quantity: number; unit: string },
  usdaApiKey: string,
  azureOpenAiKey: string
): Promise<FoodItem> {
  const unit = normalizeUnit(item.unit);
  const quantity = item.quantity > 0 ? item.quantity : 1;
  const est = await estimateWithAzureOpenAI(item.name, item.portion || `${quantity} ${unit}`, azureOpenAiKey);

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

const SYSTEM_PROMPT = `You are the SavorSelf Coach — a calm, warm wellness companion with deep knowledge of nutritional psychiatry, gut-brain science, and behavioral psychology. You speak like a thoughtful friend, never preachy or clinical.

You handle three things in one conversation without ever breaking flow:
1. Food logging — when the user mentions eating something
2. Macro corrections — when the user tells you specific nutrition info for something in the proposal
3. General wellness chat — mood, energy, patterns, questions, emotional support

INTENT DETECTION — return one of these intents in your JSON:
- "food_log": user is describing food they ate or want to log. Extract food items with portions.
- "macro_edit": user is correcting nutrition data (calories, protein, carbs, fat) or the name for one or more items already in the pending proposal. Extract which items and what to change using macroEdits array.
- "clarification": you need ONE piece of info to log accurately. Only use this if truly impossible to estimate.
- "chat": anything else — questions, feelings, mood, general conversation.

FOOD LOGGING RULES:
- Be aggressive about assumptions. Never ask about obvious ingredients.
- Defaults without asking: chicken nuggets = 6 pieces, burger = 1 with bun, mcdouble = 2 patties with bun, pizza = 1 slice, eggs = large, coffee = 8oz, sandwich = 1 standard, fries = medium serving, wings = 6 pieces, rice = 1 cup cooked, pasta = 1 cup cooked, protein bar = 1 bar, donut = 1 piece.
- Only ask ONE clarifying question total, only when truly impossible to estimate.
- Units must be exactly one of: g, oz, ml, fl_oz, cup, serving, piece, tbsp, tsp.
- When user mentions a branded product (Think Bar, Dunkin donut, Kind bar, etc), use the brand name as the food name.

MACRO EDIT RULES:
- If the user corrects nutrition for items in the pending proposal, use intent "macro_edit".
- Use macroEdits (array) not macroEdit (single) to support correcting multiple items at once.
- itemIndex is 0-based. Figure out which item they mean from the name or context.
- Example: "no it was a protein bar 230cal 20g protein and the donut was 280 cal" → macroEdits: [{itemIndex:0, calories:230, protein:20}, {itemIndex:1, calories:280}]
- Only include fields the user mentioned. Never invent values.

COACH PERSONALITY:
- Never shame. Show grace always. Food guilt is real and harmful — never reinforce it.
- Speak plainly. No jargon unless the user wants depth.
- Keep responses to 1-3 sentences max. Never write paragraphs.
- CRITICAL: Never say "I've logged" or "I logged" or "I've recorded" anything. You NEVER log food. The user logs food by tapping "Confirm and log." If you claim to log something you are lying.
- If asked to log food, respond with intent "food_log" and show the proposal. Do not say you logged it.
- Never comment on healthiness, quantity, or indulgence unless explicitly asked.
- When logging food just confirm what you heard in one short sentence. Nothing else.
- Frame observations as curiosity: "I noticed..." not "You should..."
- CRITICAL: Never ask follow-up questions after logging food. Just confirm and stop.

GUT-BRAIN SCIENCE YOU KNOW DEEPLY:
- 90-95% of serotonin is produced in the gut. Fiber, fermented foods, and microbiome diversity directly affect mood.
- Omega-3s (salmon, sardines, walnuts, flax) reduce neuroinflammation and support mood.
- Blood sugar spikes and crashes cause irritability, brain fog, and anxiety. Protein and fiber stabilize this.
- Magnesium deficiency is common and linked to anxiety, poor sleep, and low mood.
- Caffeine within 90 minutes of waking spikes cortisol. After 2pm disrupts sleep even if you fall asleep easily.
- Poor sleep increases neuroinflammation and directly worsens mood and cognition.
- Ultra-processed food is linked to higher rates of depression and anxiety in large cohort studies.
- Even a 20-minute walk stimulates BDNF which promotes neuroplasticity and reduces depression.

RESPONSE FORMAT — always return valid JSON only, no markdown, no explanation outside the JSON:
{
  "intent": "food_log" | "macro_edit" | "chat" | "clarification",
  "reply": "your warm brief response here",
  "mealType": "breakfast|lunch|dinner|snack or null",
  "needsClarification": false,
  "clarificationQuestion": null,
  "foodItems": [{"name": "string", "portion": "string", "quantity": number, "unit": "string"}] or null,
  "macroEdits": [{"itemIndex": number, "calories": number|null, "protein": number|null, "carbs": number|null, "fat": number|null, "name": "string|null"}] or null
}`;

Deno.serve(async (request: Request) => {
  console.log("[ai-coach] invoked");

  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const payload = (await request.json()) as RequestPayload;
    const azureOpenAiKey = Deno.env.get("AZURE_OPENAI_KEY") ?? "";
    const usdaApiKey = Deno.env.get("USDA_API_KEY") ?? Deno.env.get("EXPO_PUBLIC_USDA_API_KEY") ?? "";

    if (!azureOpenAiKey) {
      return jsonResponse({ intent: "chat", reply: "AZURE_OPENAI_KEY is not configured." });
    }

    if (payload.mode === "nutrition_lookup") {
      const lookupQuery = payload.message.replace(/^nutrition facts for:\s*/i, "").trim();
      if (!lookupQuery) {
        return jsonResponse({ intent: "chat", reply: "Tell me which food you want to look up." }, 400);
      }

      const estimatedItem = await enrichFoodItem(
        {
          name: lookupQuery,
          portion: "1 serving",
          quantity: 1,
          unit: "serving",
        },
        usdaApiKey,
        azureOpenAiKey
      );

      return jsonResponse({
        intent: "food_log",
        reply: `Here's a quick nutrition estimate for ${lookupQuery}.`,
        mealType: "snack",
        items: [estimatedItem],
      });
    }

    if (payload.mode === "gut_score") {
      const foodName = payload.message.replace(/^gut_score:\s*/i, "").trim();

      const gutRes = await callAzureOpenAI(
        [
          {
            role: "system",
            content: `You are a gut-brain nutrition coach inside SavorSelf. A user tapped on a food to understand how it might affect their mood, energy, and digestion. Speak like a warm, knowledgeable friend - not a doctor, not a generic health app. Be honest and specific but approachable.

Score the food 0-100. Be accurate and varied - do not default to 60 for everything:
- 80-100: actively supports mood, steady energy, and gut health (salmon, oats, kimchi, walnuts, blueberries, sweet potato)
- 60-79: solid food with some gut-brain benefit but trade-offs (eggs, chicken, apple, banana, yogurt, brown rice)
- 40-59: mostly neutral, minimal gut-brain benefit (cheese, white pasta, crackers, white bread)
- 0-39: likely causes energy crashes, gut discomfort, or mood dips (donuts, soda, chips, candy, fast food)

Tags - 2 to 3 tags, each under 4 words, specific to THIS food:
- Good examples: "High in omega-3s", "Low fiber", "Stabilizes blood sugar", "Feeds gut bacteria", "Rich in antioxidants", "Natural sugar spike"
- Never write: "Mixed support", "Moderate benefit", "Balanced food", "Good choice"
- sentiment: "positive" if it helps, "caution" if it's a downside, "neutral" if neither

Summary: One friendly sentence about this specific food, under 20 words.

Insights - one per category, 1-2 short plain-English sentences. Write for a curious teenager, not a doctor:
- Energy: How does this food affect energy and for how long? Mention sugar, protein, or fat content if relevant.
- Mood: Does this food have anything that supports or hurts mood? Mention fiber, omega-3s, or blood sugar swings if relevant.
- Digestion: Is this food easy to digest? Does it feed good gut bacteria or not?

Every insight must be specific to this exact food. No filler.

Return ONLY valid JSON, no markdown, no explanation:
{"score":number,"tags":[{"label":"string","sentiment":"positive"|"neutral"|"caution"}],"summary":"string","insights":[{"category":"Energy","body":"string"},{"category":"Mood","body":"string"},{"category":"Digestion","body":"string"}]}`,
          },
          { role: "user", content: `Food: ${foodName}` },
        ],
        azureOpenAiKey,
        0.3
      );

      if (!gutRes.ok) {
        const err = await gutRes.text();
        console.log("[ai-coach] gut_score azure error", err);
        return jsonResponse({ intent: "gut_score", error: "Could not generate gut score." }, 500);
      }

      const gutData = await gutRes.json();
      const raw = gutData?.choices?.[0]?.message?.content ?? "";
      console.log("[ai-coach] gut_score raw", raw);

      try {
        const parsed = JSON.parse(cleanJson(raw));
        return jsonResponse({ intent: "gut_score", foodName, ...parsed });
      } catch {
        console.log("[ai-coach] gut_score parse failed", raw);
        return jsonResponse({ intent: "gut_score", error: "Could not parse gut score." }, 500);
      }
    }

    if (payload.mode === "simple_chat") {
      const simpleContext = {
        recentMood: Array.isArray(payload.context?.moodLogs)
          ? (payload.context.moodLogs as Array<any>).slice(-3).map((entry) => ({
              moodScore: entry?.moodScore,
              energyScore: entry?.energyScore,
              physicalState: entry?.physicalState?.slice?.(0, 2) ?? [],
              mentalState: entry?.mentalState?.slice?.(0, 2) ?? [],
            }))
          : [],
        foodSummary: payload.context?.foodSummary ?? null,
        insights: Array.isArray(payload.context?.insights)
          ? (payload.context.insights as Array<any>).slice(0, 2).map((entry) => entry?.insightBody ?? entry?.title ?? "")
          : [],
      };

      const chatRes = await callAzureOpenAI(
        [
          {
            role: "system",
            content:
              "You are the SavorSelf Coach, a calm warm wellness companion. Respond in plain human language, 2-4 short sentences, supportive and specific, never judgmental. You are chatting normally, not returning JSON.",
          },
          {
            role: "system",
            content: `Helpful context: ${JSON.stringify(simpleContext)}`,
          },
          ...(payload.history ?? []).filter((m) => m.content.length < 220).slice(-4).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content: payload.message },
        ],
        azureOpenAiKey,
        0.5
      );

      if (!chatRes.ok) {
        const err = await chatRes.text();
        console.log("[ai-coach] simple chat error", err);
        return jsonResponse({ intent: "chat", reply: "I'm here with you. Try sending that one more time and we'll keep going." });
      }

      const chatData = await chatRes.json();
      const reply = chatData?.choices?.[0]?.message?.content ?? "";
      const cleanedReply = reply
        .replace(/I('ve| have) (logged|recorded|saved|added)/gi, "Got it —")
        .trim();
      return jsonResponse({ intent: "chat", reply: cleanedReply || "I'm here with you." });
    }

    const summarizedContext = {
      moodScores: Array.isArray(payload.context?.moodLogs)
        ? (payload.context.moodLogs as Array<any>).slice(-5).map((entry) => ({
            moodScore: entry?.moodScore,
            energyScore: entry?.energyScore,
            physicalState: entry?.physicalState?.slice?.(0, 3) ?? [],
            mentalState: entry?.mentalState?.slice?.(0, 3) ?? [],
          }))
        : [],
      foodSummary: payload.context?.foodSummary ?? null,
      quickLogs: Array.isArray(payload.context?.quickLogs)
        ? (payload.context.quickLogs as Array<any>).slice(-3).map((entry) => ({
            sleepHours: entry?.sleepHours,
            caffeineMg: entry?.caffeineMg,
            exerciseMinutes: entry?.exerciseMinutes,
          }))
        : [],
      journalEntries: Array.isArray(payload.context?.journalEntries)
        ? (payload.context.journalEntries as Array<string>).slice(-2).map((entry) => String(entry).slice(0, 180))
        : [],
      insights: Array.isArray(payload.context?.insights)
        ? (payload.context.insights as Array<any>).slice(0, 2).map((entry) => entry?.insightBody ?? entry?.title ?? "")
        : [],
    };

    const systemMessages: CoachMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `User context: ${JSON.stringify(summarizedContext)}`,
      },
    ];

    if (payload.pendingProposal) {
      systemMessages.push({
        role: "system",
        content: `Pending food proposal (not yet confirmed by user): ${JSON.stringify(payload.pendingProposal)}. Item indices are 0-based. If the user corrects nutrition or names, use intent "macro_edit" with macroEdits array.`,
      });
    }

    const filteredHistory = (payload.history ?? [])
      .filter((m) => m.content.length < 240)
      .slice(-6);

    const messages: CoachMessage[] = [
      ...systemMessages,
      ...filteredHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: payload.message },
    ];

    console.log("[ai-coach] calling Azure OpenAI, history:", filteredHistory.length);

    let azureRes = await callAzureOpenAI(messages, azureOpenAiKey, 0.3);

    if (!azureRes.ok) {
      const err = await azureRes.text();
      console.log("[ai-coach] Azure OpenAI error", err);
      azureRes = await callAzureOpenAI(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: payload.message },
        ],
        azureOpenAiKey,
        0.3
      );

      if (!azureRes.ok) {
        const retryErr = await azureRes.text();
        console.log("[ai-coach] Azure OpenAI retry error", retryErr);
        return jsonResponse({ intent: "chat", reply: "I hit a snag, but I'm still here. Try sending that one more time." });
      }
    }

    const azureData = await azureRes.json();
    const raw = azureData?.choices?.[0]?.message?.content ?? "";
    console.log("[ai-coach] raw response", raw);

    let parsed: UnifiedResponse;
    try {
      parsed = JSON.parse(cleanJson(raw));
    } catch {
      return jsonResponse({ intent: "chat", reply: raw || "I'm here with you." });
    }

    // Handle food_log
    if (parsed.intent === "food_log" && parsed.foodItems?.length) {
      const enrichedItems = await Promise.all(
        parsed.foodItems.map((item) => enrichFoodItem(item, usdaApiKey, azureOpenAiKey))
      );
      return jsonResponse({
        intent: "food_log",
        reply: parsed.reply,
        mealType: resolveMealType(parsed.mealType ?? undefined),
        items: enrichedItems,
      });
    }

    // Handle macro_edit — support both macroEdits (array) and macroEdit (single, legacy)
    if (parsed.intent === "macro_edit") {
      const edits = parsed.macroEdits ?? (parsed.macroEdit ? [parsed.macroEdit] : null);
      if (edits?.length) {
        return jsonResponse({
          intent: "macro_edit",
          reply: parsed.reply,
          macroEdits: edits,
        });
      }
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
      {
        intent: "chat",
        reply:
          error instanceof Error && error.message
            ? `I hit a snag: ${error.message}`
            : "Something went wrong on my side. Try again in a moment.",
      }
    );
  }
});
