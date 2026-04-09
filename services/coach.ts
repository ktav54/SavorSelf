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

export async function sendMessage(input: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  context: Record<string, unknown>;
  pendingProposal?: CoachFoodProposal | null;
}): Promise<CoachResponse> {
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
    throw new Error(payload?.error ?? `Coach failed with ${response.status}.`);
  }

  return payload as CoachResponse;
}
