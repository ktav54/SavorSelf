import type { CoachFoodProposal } from "@/types/models";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

type CoachHistoryMessage = { role: "user" | "assistant"; content: string };

const COACH_RESPONSE_STYLE_INSTRUCTIONS =
  "Never offer unsolicited emotional commentary after logging food. When food is logged, confirm briefly and move on. Never say things like 'getting this logged matters' or 'showing up counts' unless the user explicitly asks for encouragement. Keep responses concise — 1-3 sentences for most replies. Never use filler phrases like 'Absolutely!', 'Great question!', 'Of course!', 'Certainly!', or 'Sure thing!'.";

function normalizeCoachPayload<T extends { reply?: string }>(payload: T | string): T {
  let normalized: unknown = payload;

  if (typeof normalized === "string") {
    try {
      normalized = JSON.parse(normalized);
    } catch {
      return { reply: normalized } as T;
    }
  }

  if (normalized && typeof normalized === "object" && "reply" in normalized) {
    const reply = (normalized as { reply?: unknown }).reply;
    if (typeof reply === "string") {
      const trimmed = reply.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsedReply = JSON.parse(trimmed);
          if (typeof parsedReply?.reply === "string") {
            (normalized as { reply?: string }).reply = parsedReply.reply;
          }
        } catch {}
      }
    }
  }

  return normalized as T;
}

async function callEdgeFunction<TRequest, TResponse>(functionName: string, body: TRequest): Promise<TResponse> {
  const attempt = async () => {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error ?? `Edge Function ${functionName} failed with ${response.status}.`);
    }

    return payload as TResponse;
  };

  try {
    return await attempt();
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      return await attempt();
    } catch {
      throw firstError;
    }
  }
}

export async function sendCoachMessage(
  message: string,
  context: Record<string, unknown>,
  history: CoachHistoryMessage[] = []
) {
  const response = await callEdgeFunction<
    {
      message: string;
      context: Record<string, unknown>;
      history: CoachHistoryMessage[];
      mode: string;
    },
    { intent?: string; reply?: string }
  >("ai-coach", {
    message,
    context: {
      ...context,
      coachResponseStyle: COACH_RESPONSE_STYLE_INSTRUCTIONS,
    },
    history,
    mode: "simple_chat",
  });

  return normalizeCoachPayload(response);
}

export async function parseFoodMessage(input: {
  message: string;
  pendingProposal?: CoachFoodProposal | null;
  history?: CoachHistoryMessage[];
  context?: Record<string, unknown>;
}) {
  const response = await callEdgeFunction<
    {
      message: string;
      pendingProposal?: CoachFoodProposal | null;
      history?: CoachHistoryMessage[];
      context: Record<string, unknown>;
    },
    {
      intent?: string;
      reply?: string;
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
      macroEdit?: {
        itemIndex: number;
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
        name?: string;
      };
    }
  >("ai-coach", {
    message: input.message,
    pendingProposal: input.pendingProposal ?? null,
    history: input.history ?? [],
    context: {
      ...(input.context ?? {}),
      coachResponseStyle: COACH_RESPONSE_STYLE_INSTRUCTIONS,
    },
  });

  return normalizeCoachPayload(response);
}
