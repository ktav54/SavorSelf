import type { CoachFoodProposal } from "@/types/models";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

async function callEdgeFunction<TRequest, TResponse>(functionName: string, body: TRequest) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? `Edge Function ${functionName} failed with ${response.status}.`);
  }

  return payload as TResponse;
}

export async function sendCoachMessage(
  message: string,
  context: Record<string, unknown>,
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>
) {
  return callEdgeFunction<
    {
      message,
      context,
      history,
    },
    { reply: string; summary?: string }
  >("ai-coach", {
    message,
    context,
    history,
  });
}

export async function parseFoodMessage(input: {
  message: string;
  pendingProposal?: CoachFoodProposal | null;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}) {
  return callEdgeFunction<
    {
      message: string;
      pendingProposal?: CoachFoodProposal | null;
      history?: Array<{
        role: "user" | "assistant";
        content: string;
      }>;
    },
    {
      isFoodLogging: boolean;
      isCalorieEdit?: boolean;
      editCalories?: number | null;
      needsClarification: boolean;
      question?: string;
      mealType?: "breakfast" | "lunch" | "dinner" | "snack";
      items?: CoachFoodProposal["items"];
    }
  >("ai-food-parser", input);
}
