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

interface CoordinatorTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface CoordinatorStorage {
  transaction<T>(closure: (txn: CoordinatorTransaction) => Promise<T>): Promise<T>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAll(): Promise<void>;
}

interface DurableObjectStateLike {
  storage: CoordinatorStorage;
}

type Genre = "jazz" | "blues" | "funk" | "rnb" | "bossa";
const GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];
// Grok normally takes about 145s; cap a stalled request well below the cron's
// 15-minute wall-time so generateDailyLick can still fall back to Haiku.
const GROK_TIMEOUT_MS = 5 * 60 * 1000;

// Pointer to the most-recent lick, kept in sync with the day key so the Pages
// function can serve it stale-while-revalidate on a same-day cache miss.
const LATEST_KEY = "daily:latest";
const REFRESH_LOCK_TTL_MS = 60_000;
const RATE_LIMIT_MAX = 10;

interface RefreshLease {
  token: string;
  expiresAt: number;
}

// Pages Functions bind this class as an external Durable Object. A distinct
// object ID per daily key / IP-window makes the transactions below the single,
// strongly consistent admission point for cache refreshes and rate limits.
export class LickCoordinator {
  constructor(private readonly state: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (path === "/refresh/acquire") {
      const lease = await this.state.storage.transaction(async (txn) => {
        const current = await txn.get<RefreshLease>("refresh-lease");
        if (current && current.expiresAt > Date.now()) return undefined;
        const next = { token: crypto.randomUUID(), expiresAt: Date.now() + REFRESH_LOCK_TTL_MS };
        await txn.put("refresh-lease", next);
        return next;
      });
      return lease ? Response.json(lease) : new Response(null, { status: 409 });
    }

    if (path === "/refresh/release") {
      const token = request.headers.get("X-Lick-Lease-Token");
      await this.state.storage.transaction(async (txn) => {
        const current = await txn.get<RefreshLease>("refresh-lease");
        if (current?.token === token) await txn.delete("refresh-lease");
      });
      return new Response(null, { status: 204 });
    }

    if (path === "/rate-limit/admit") {
      const admitted = await this.state.storage.transaction(async (txn) => {
        const current = (await txn.get<number>("count")) ?? 0;
        if (current >= RATE_LIMIT_MAX) return false;
        await txn.put("count", current + 1);
        return true;
      });
      if (admitted) await this.state.storage.setAlarm(Date.now() + 2 * 60 * 60 * 1000);
      return new Response(null, { status: admitted ? 204 : 429 });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
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
  // id goes LAST so the UTC-date key always wins over any id the model emitted
  // in its JSON (main's daily-cache keying depends on this).
  return { ...JSON.parse(extractJSON(rawText)), id: getTodayKey() };
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
  return { ...JSON.parse(jsonString), id: getTodayKey() };
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
      const lick = await generateDailyLick(genre, env);
      const key = `daily:${getTodayKey()}`;
      const payload = JSON.stringify(lick);
      await env.LICK_STORE.put(key, payload, { expirationTtl: 90000 });
      await env.LICK_STORE.put(LATEST_KEY, payload, { expirationTtl: 90000 });
      return Response.json({ ok: true, key, genre });
    }
    return new Response("Lick of the Day cron worker", { status: 200 });
  },
};
