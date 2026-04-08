interface InsightPayload {
  userId: string;
  last30Days: {
    moodLogs: unknown[];
    foodLogs: unknown[];
    quickLogs: unknown[];
    journalEntries: unknown[];
  };
}

const INSIGHT_PROMPT = `You generate concise, human insight cards for SavorSelf. Use only the supplied user data. Never shame, diagnose, or overclaim causality. Prefer phrases like "seems", "may", "trend", and "often". Return JSON with an insights array containing insight_type, insight_body, and supporting_data.`;

Deno.serve(async (request) => {
  const payload = (await request.json()) as InsightPayload;
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    return Response.json({
      insights: [
        {
          insight_type: "placeholder",
          insight_body: "Weekly insight generation is ready once OPENAI_API_KEY is configured.",
          supporting_data: { userId: payload.userId },
        },
      ],
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INSIGHT_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!response.ok) {
    return Response.json({ error: "Failed to generate insights." }, { status: 500 });
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content ?? '{"insights": []}';

  return new Response(content, {
    headers: {
      "Content-Type": "application/json",
    },
  });
});
