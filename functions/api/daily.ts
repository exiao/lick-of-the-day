import { buildLickPrompt } from "../_shared/prompt";
import { FALLBACK_LICK } from "../_shared/fallback";
import { extractJSON } from "../_shared/parse";

interface Env {
  ANTHROPIC_API_KEY: string;
}

type Genre = "jazz" | "blues" | "funk" | "rnb" | "bossa";
const GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

// In-memory cache (persists within a single isolate).
// TODO: Move to KV or D1 for cross-isolate persistence.
const cache = new Map<string, { lick: unknown; expires: number }>();

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const todayKey = `lick:${getTodayKey()}`;

  const cached = cache.get(todayKey);
  if (cached && cached.expires > Date.now()) {
    return Response.json(cached.lick);
  }

  const genre = GENRES[getDayOfYear() % GENRES.length];

  try {
    const { system, user } = buildLickPrompt(genre, 4);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": context.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic API error:", res.status, await res.text());
      return Response.json(FALLBACK_LICK);
    }

    const data = (await res.json()) as { content: { type: string; text: string }[] };
    const rawText = data.content[0]?.type === "text" ? data.content[0].text : "";
    const lick = { id: getTodayKey(), ...JSON.parse(extractJSON(rawText)) };

    cache.set(todayKey, { lick, expires: Date.now() + 24 * 60 * 60 * 1000 });

    return Response.json(lick);
  } catch (err) {
    console.error("Failed to generate daily lick:", err);
    return Response.json(FALLBACK_LICK);
  }
};
