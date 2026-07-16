import { buildLickPrompt } from "../../functions/_shared/prompt";
import { extractJSON } from "../../functions/_shared/parse";
import {
  LICK_MODEL,
  LICK_MAX_TOKENS,
  GROK_MODEL,
  GROK_MAX_TOKENS,
} from "../../functions/_shared/lick-config";

interface Env {
  ANTHROPIC_API_KEY: string;
  XAI_API_KEY: string;
  LICK_STORE: KVNamespace;
}

type Genre = "jazz" | "blues" | "funk" | "rnb" | "bossa";
const GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];
// Grok normally takes about 145s; cap a stalled request well below the cron's
// 15-minute wall-time so generateDailyLick can still fall back to Haiku.
const GROK_TIMEOUT_MS = 5 * 60 * 1000;

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function pickGenre(): Genre {
  // Deterministic from day-of-year so it rotates predictably
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return GENRES[dayOfYear % GENRES.length];
}

// Haiku via Anthropic. Fast (~8s); used as the cron fallback and for all
// user-facing paths (daily.ts cold-start, random.ts).
async function generateWithHaiku(genre: Genre, apiKey: string): Promise<unknown> {
  const { system, user } = buildLickPrompt(genre, 4);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: LICK_MODEL,
      max_tokens: LICK_MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { content: { type: string; text: string }[] };
  const rawText = data.content[0]?.type === "text" ? data.content[0].text : "";
  return { id: getTodayKey(), ...JSON.parse(extractJSON(rawText)) };
}

// Grok 4.5 via xAI's OpenAI-compatible chat/completions. Best musical quality
// (see lick-config note) but ~145s/call due to uncappable reasoning — only
// acceptable here in the midnight cron where no user waits.
async function generateWithGrok(genre: Genre, apiKey: string): Promise<unknown> {
  const { system, user } = buildLickPrompt(genre, 4);

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(GROK_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      max_tokens: GROK_MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`xAI API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const rawText = data.choices[0]?.message?.content ?? "";
  const jsonString = extractJSON(rawText);
  if (!jsonString) {
    throw new Error("xAI API returned empty content that cannot be parsed as JSON.");
  }
  return { id: getTodayKey(), ...JSON.parse(jsonString) };
}

// Generate the daily lick: prefer grok for quality, fall back to haiku if grok
// errors, times out, or its key is missing. The fallback guarantees the cron
// still populates KV even when xAI is down.
async function generateDailyLick(genre: Genre, env: Env): Promise<unknown> {
  if (env.XAI_API_KEY) {
    try {
      return await generateWithGrok(genre, env.XAI_API_KEY);
    } catch (err) {
      console.error(`Grok generation failed, falling back to haiku: ${err}`);
    }
  } else {
    console.warn("XAI_API_KEY not set; using haiku for daily lick");
  }
  return generateWithHaiku(genre, env.ANTHROPIC_API_KEY);
}

export default {
  // Runs at midnight UTC every day
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const genre = pickGenre();
    console.log(`Generating daily lick: genre=${genre}`);

    const lick = await generateDailyLick(genre, env);
    const key = `daily:${getTodayKey()}`;

    await env.LICK_STORE.put(key, JSON.stringify(lick), {
      expirationTtl: 90000, // ~25 hours, auto-expires after tomorrow
    });

    console.log(`Daily lick stored: key=${key}`);
  },

  // Also handle HTTP requests so we can manually trigger for testing
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/trigger" && request.method === "POST") {
      const genre = pickGenre();
      const lick = await generateDailyLick(genre, env);
      const key = `daily:${getTodayKey()}`;
      await env.LICK_STORE.put(key, JSON.stringify(lick), { expirationTtl: 90000 });
      return Response.json({ ok: true, key, genre });
    }
    return new Response("Lick of the Day cron worker", { status: 200 });
  },
};
