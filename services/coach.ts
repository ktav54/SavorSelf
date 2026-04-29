import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import type { CoachFoodProposal } from "@/types/models";

type CoachHistoryMessage = { role: "user" | "assistant"; content: string };

const COACH_RESPONSE_STYLE_INSTRUCTIONS = [
  "Never offer unsolicited emotional commentary after logging food.",
  "When food is logged, confirm briefly and move on.",
  "Never say things like 'getting this logged matters' or 'showing up counts' unless the user explicitly asks for encouragement.",
  "Keep responses concise - 1-3 sentences for most replies.",
  "Never use filler phrases like 'Absolutely!', 'Great question!', 'Of course!', 'Certainly!', or 'Sure thing!'.",
  "Format your responses clearly:",
  "- Use numbered lists when giving step-by-step advice.",
  "- Use bullet points for listing multiple options.",
  "- Keep responses under 150 words unless the user asks for more detail.",
  "- Never start a response with 'I' - vary your sentence openers.",
  "- Never use em dashes in responses.",
  "- When logging food, confirm briefly then stop.",
  "- When the user asks a question, answer it directly in the first sentence.",
].join(" ");

function buildCoachPromptContext(context: Record<string, unknown>) {
  const name =
    typeof context.profileName === "string" && context.profileName.trim()
      ? context.profileName.trim()
      : "the user";
  const todaysMood =
    context.todaysMood && typeof context.todaysMood === "object"
      ? (context.todaysMood as {
          score?: number;
          energy?: number;
          physicalStates?: string[];
          mentalStates?: string[];
          note?: string;
        })
      : null;
  const onboardingGoal =
    typeof context.onboardingGoal === "string" && context.onboardingGoal.trim()
      ? context.onboardingGoal.trim()
      : "";
  const onboardingChallenge =
    typeof context.onboardingChallenge === "string" && context.onboardingChallenge.trim()
      ? context.onboardingChallenge.trim()
      : "";

  const coachIdentityPrompt = [
    `You are talking to ${name}.`,
    `The user's name is ${name}. Use their name occasionally but not in every message - only when it feels natural.`,
  ].join(" ");
  const coachGoalPrompt = onboardingGoal
    ? `The user's primary goal is: ${onboardingGoal}. Keep this in mind when giving suggestions and insights.`
    : "";
  const coachChallengePrompt = onboardingChallenge
    ? `Their biggest challenge is: ${onboardingChallenge}. Be sensitive to this and offer relevant support.`
    : "";

  const coachTodaysMoodPrompt = todaysMood
    ? `Today's mood check-in: mood ${todaysMood.score ?? "?"}/5, energy ${todaysMood.energy ?? "?"}/5. Physical: ${todaysMood.physicalStates?.join(", ") || "none noted"}. Mental: ${todaysMood.mentalStates?.join(", ") || "none noted"}.${todaysMood.note ? ` Note: "${todaysMood.note}"` : ""}`
    : "";

  return {
    ...context,
    coachIdentityPrompt,
    coachGoalPrompt,
    coachChallengePrompt,
    coachTodaysMoodPrompt,
    coachSystemPromptAddendum: [
      coachIdentityPrompt,
      coachGoalPrompt,
      coachChallengePrompt,
      coachTodaysMoodPrompt,
      COACH_RESPONSE_STYLE_INSTRUCTIONS,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

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
      ...buildCoachPromptContext(context),
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
      ...buildCoachPromptContext(input.context ?? {}),
      coachResponseStyle: COACH_RESPONSE_STYLE_INSTRUCTIONS,
    },
  });

  return normalizeCoachPayload(response);
}
