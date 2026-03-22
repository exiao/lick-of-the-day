import { buildLickPrompt } from "../../functions/_shared/prompt";
import { extractJSON } from "../../functions/_shared/parse";

interface Env {
  ANTHROPIC_API_KEY: string;
  LICK_STORE: KVNamespace;
}

type Genre = "jazz" | "blues" | "funk" | "rnb" | "bossa";
const GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];

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

async function generateLick(genre: Genre, apiKey: string): Promise<unknown> {
  const { system, user } = buildLickPrompt(genre, 4);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
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
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { content: { type: string; text: string }[] };
  const rawText = data.content[0]?.type === "text" ? data.content[0].text : "";
  const todayKey = getTodayKey();
  return { id: todayKey, ...JSON.parse(extractJSON(rawText)) };
}

export default {
  // Runs at midnight UTC every day
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const genre = pickGenre();
    console.log(`Generating daily lick: genre=${genre}`);

    const lick = await generateLick(genre, env.ANTHROPIC_API_KEY);
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
      const lick = await generateLick(genre, env.ANTHROPIC_API_KEY);
      const key = `daily:${getTodayKey()}`;
      await env.LICK_STORE.put(key, JSON.stringify(lick), { expirationTtl: 90000 });
      return Response.json({ ok: true, key, genre });
    }
    return new Response("Lick of the Day cron worker", { status: 200 });
  },
};
