// services/coach.ts
import type { CoachFoodProposal } from "@/types/models";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export type CoachIntent = "food_log" | "macro_edit" | "chat" | "clarification";

export interface MacroEdit {
  itemIndex: number;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  name?: string | null;
}

export interface CoachResponse {
  intent: CoachIntent;
  reply: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  items?: CoachFoodProposal["items"];
  macroEdit?: MacroEdit;
}

function buildLocalCoachReply(
  message: string,
  context: Record<string, unknown>
): CoachResponse {
  const normalized = message.trim().toLowerCase();
  const foodSummary = (context.foodSummary as { averageFiber?: number; averageProtein?: number } | undefined) ?? {};
  const averageFiber = Math.round(foodSummary.averageFiber ?? 0);
  const averageProtein = Math.round(foodSummary.averageProtein ?? 0);

  if (/\b(feel|feeling|mood|anxious|stressed|overwhelmed|sad|off|tired|exhausted)\b/i.test(normalized)) {
    return {
      intent: "chat",
      reply:
        averageFiber > 0 || averageProtein > 0
          ? `It makes sense to check in on that. From what you've logged lately, your meals have been averaging about ${averageFiber}g of fiber and ${averageProtein}g of protein, which can shape how steady or crashy the day feels. Tell me a little more about what feels hardest right now.`
          : "It makes sense to check in on that. We can keep this simple and sort through it together. Tell me a little more about what feels hardest right now.",
    };
  }

  if (/\b(why|how|what does this mean|what should i do|help)\b/i.test(normalized)) {
    return {
      intent: "chat",
      reply:
        "We can look at this one step at a time. I can help you think through what might be affecting your mood, energy, or meals today. Tell me which part you want to untangle first.",
    };
  }

  return {
    intent: "chat",
    reply: "I'm here with you. Tell me a little more and we'll work through it together.",
  };
}

function looksLikeFoodLoggingMessage(message: string) {
  return /\b(i had|i ate|i drank|for breakfast|for lunch|for dinner|for a snack|log this|log my|add this|ate|drank)\b/i.test(
    message
  );
}

function looksLikeMacroEditMessage(message: string) {
  return /\b(cal|calories|protein|carbs|fat|change|update|adjust|rename|actually it was|make it)\b/i.test(message);
}

export async function sendMessage(input: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  context: Record<string, unknown>;
  pendingProposal?: CoachFoodProposal | null;
}): Promise<CoachResponse> {
  const trimmedMessage = input.message.trim();
  const mode =
    input.pendingProposal && looksLikeMacroEditMessage(trimmedMessage)
      ? undefined
      : looksLikeFoodLoggingMessage(trimmedMessage)
        ? undefined
        : "simple_chat";

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: input.message,
      history: input.history,
      context: input.context,
      mode,
      pendingProposal: input.pendingProposal
        ? {
            mealType: input.pendingProposal.mealType,
            items: input.pendingProposal.items.map((item) => ({
              name: item.name,
              portion: item.portion,
              quantity: item.quantity,
              unit: item.unit,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
            })),
          }
        : null,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    return buildLocalCoachReply(input.message, input.context);
  }

  const reply = typeof payload?.reply === "string" ? payload.reply.trim() : "";
  if (!reply || /hit a snag|try sending that one more time/i.test(reply)) {
    return buildLocalCoachReply(input.message, input.context);
  }

  return payload as CoachResponse;
}
