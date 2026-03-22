import { buildLickPrompt } from "../_shared/prompt";
import { FALLBACK_LICK } from "../_shared/fallback";
import { extractJSON, validateNotes } from "../_shared/parse";

interface Env {
  ANTHROPIC_API_KEY: string;
  LICK_STORE: KVNamespace;
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kvKey = `daily:${getTodayKey()}`;

  // Try KV first — shared across all isolates, written by cron worker at midnight
  if (context.env.LICK_STORE) {
    const cached = await context.env.LICK_STORE.get(kvKey);
    if (cached) {
      return Response.json(JSON.parse(cached));
    }
  }

  // Cold start: cron hasn't run yet (or KV unavailable) — generate on demand
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
    const parsed = JSON.parse(extractJSON(rawText));
    validateNotes(parsed.notes, parsed.bars ?? 4);
    const lick = { id: getTodayKey(), ...parsed };

    // Write to KV so subsequent requests (and isolates) get the same lick
    if (context.env.LICK_STORE) {
      await context.env.LICK_STORE.put(kvKey, JSON.stringify(lick), {
        expirationTtl: 90000,
      });
    }

    return Response.json(lick);
  } catch (err) {
    console.error("Failed to generate daily lick:", err);
    // Do not cache the fallback — let next request retry the API
    return Response.json(FALLBACK_LICK);
  }
};
