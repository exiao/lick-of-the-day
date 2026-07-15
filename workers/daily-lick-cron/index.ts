import { buildLickPrompt } from "../../functions/_shared/prompt";
import { extractJSON } from "../../functions/_shared/parse";
import { LICK_MODEL, LICK_MAX_TOKENS } from "../../functions/_shared/lick-config";

interface Env {
  ANTHROPIC_API_KEY: string;
  LICK_STORE: KVNamespace;
}

interface CoordinatorTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface CoordinatorStorage {
  transaction<T>(closure: (txn: CoordinatorTransaction) => Promise<T>): Promise<T>;
}

interface DurableObjectStateLike {
  storage: CoordinatorStorage;
}

type Genre = "jazz" | "blues" | "funk" | "rnb" | "bossa";
const GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];

// Pointer to the most-recent lick, kept in sync with the day key so the Pages
// function can serve it stale-while-revalidate on a same-day cache miss.
const LATEST_KEY = "daily:latest";
const REFRESH_LOCK_TTL_MS = 60_000;
const RATE_LIMIT_MAX = 10;

// Pages Functions bind this class as an external Durable Object. A distinct
// object ID per daily key / IP-window makes the transactions below the single,
// strongly consistent admission point for cache refreshes and rate limits.
export class LickCoordinator {
  constructor(private readonly state: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (path === "/refresh/acquire") {
      const acquired = await this.state.storage.transaction(async (txn) => {
        const expiresAt = await txn.get<number>("refresh-expires-at");
        if (expiresAt && expiresAt > Date.now()) return false;
        await txn.put("refresh-expires-at", Date.now() + REFRESH_LOCK_TTL_MS);
        return true;
      });
      return new Response(null, { status: acquired ? 204 : 409 });
    }

    if (path === "/refresh/release") {
      await this.state.storage.transaction((txn) => txn.delete("refresh-expires-at"));
      return new Response(null, { status: 204 });
    }

    if (path === "/rate-limit/admit") {
      const admitted = await this.state.storage.transaction(async (txn) => {
        const current = (await txn.get<number>("count")) ?? 0;
        if (current >= RATE_LIMIT_MAX) return false;
        await txn.put("count", current + 1);
        return true;
      });
      return new Response(null, { status: admitted ? 204 : 429 });
    }

    return new Response("Not found", { status: 404 });
  }
}

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
  const todayKey = getTodayKey();
  return { ...JSON.parse(extractJSON(rawText)), id: todayKey };
}

export default {
  // Runs at midnight UTC every day
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const genre = pickGenre();
    console.log(`Generating daily lick: genre=${genre}`);

    const lick = await generateLick(genre, env.ANTHROPIC_API_KEY);
    const key = `daily:${getTodayKey()}`;
    const payload = JSON.stringify(lick);

    await env.LICK_STORE.put(key, payload, {
      expirationTtl: 90000, // ~25 hours, auto-expires after tomorrow
    });
    await env.LICK_STORE.put(LATEST_KEY, payload, { expirationTtl: 90000 });

    console.log(`Daily lick stored: key=${key}`);
  },

  // Also handle HTTP requests so we can manually trigger for testing
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/trigger" && request.method === "POST") {
      const genre = pickGenre();
      const lick = await generateLick(genre, env.ANTHROPIC_API_KEY);
      const key = `daily:${getTodayKey()}`;
      const payload = JSON.stringify(lick);
      await env.LICK_STORE.put(key, payload, { expirationTtl: 90000 });
      await env.LICK_STORE.put(LATEST_KEY, payload, { expirationTtl: 90000 });
      return Response.json({ ok: true, key, genre });
    }
    return new Response("Lick of the Day cron worker", { status: 200 });
  },
};
