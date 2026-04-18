import type { CoachFoodProposal } from "@/types/models";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

async function callEdgeFunction<TRequest, TResponse>(functionName: string, body: TRequest): Promise<TResponse> {
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
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  return callEdgeFunction<
    {
      message: string;
      context: Record<string, unknown>;
      history: Array<{ role: "user" | "assistant"; content: string }>;
      mode: string;
    },
    { intent: string; reply: string }
  >("ai-coach", {
    message,
    context,
    history,
    mode: "simple_chat",
  });
}

export async function parseFoodMessage(input: {
  message: string;
  pendingProposal?: CoachFoodProposal | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: Record<string, unknown>;
}) {
  return callEdgeFunction<
    {
      message: string;
      pendingProposal?: CoachFoodProposal | null;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      context: Record<string, unknown>;
    },
    {
      intent: string;
      reply: string;
      mealType?: "breakfast" | "lunch" | "dinner" | "snack";
      needsClarification?: boolean;
      clarificationQuestion?: string;
      items?: CoachFoodProposal["items"];
      macroEdits?: Array<{
        itemIndex: number;
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
        name?: string;
      }>;
    }
  >("ai-coach", {
    message: input.message,
    pendingProposal: input.pendingProposal ?? null,
    history: input.history ?? [],
    context: input.context ?? {},
  });
}
