import { buildLickPrompt } from "../_shared/prompt";
import { FALLBACK_LICK } from "../_shared/fallback";
import { extractJSON, validateNotes } from "../_shared/parse";
import { LICK_MODEL, LICK_MAX_TOKENS } from "../_shared/lick-config";
import type { CoordinatorNamespace } from "../_shared/coordinator";

interface Env {
  ANTHROPIC_API_KEY: string;
  LICK_STORE: KVNamespace;
  LICK_COORDINATOR?: CoordinatorNamespace;
}

type Genre = "jazz" | "blues" | "funk" | "rnb" | "bossa";
const GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];

// Pointer to the most-recent successfully-generated lick, independent of the
// day key. Lets us serve a (possibly stale) lick instantly while today's is
// regenerated in the background — stale-while-revalidate.
const LATEST_KEY = "daily:latest";

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

// Seconds until the next UTC midnight — how long today's lick stays fresh.
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.floor((midnight - now.getTime()) / 1000));
}

function jsonResponse(body: unknown, cacheControl: string, extra?: Record<string, string>): Response {
  return Response.json(body, {
    headers: { "Cache-Control": cacheControl, ...(extra ?? {}) },
  });
}

async function generateDailyLick(env: Env): Promise<Record<string, unknown>> {
  const genre = GENRES[getDayOfYear() % GENRES.length];
  const { system, user } = buildLickPrompt(genre, 4);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
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
  const parsed = JSON.parse(extractJSON(rawText));
  validateNotes(parsed.notes, parsed.bars ?? 4);
  return { ...parsed, id: getTodayKey() };
}

// Regenerate today's lick and persist it to both the day key and the latest
// pointer. Errors are swallowed — this runs in the background (waitUntil) and a
// failure just leaves the previous cached lick in place for the next request.
async function requestCoordinator(env: Env, key: string, path: string, init?: RequestInit): Promise<Response | undefined> {
  if (!env.LICK_COORDINATOR) return undefined;
  try {
    const stub = env.LICK_COORDINATOR.get(env.LICK_COORDINATOR.idFromName(key));
    return await stub.fetch(`https://lick-coordinator${path}`, { method: "POST", ...init });
  } catch (err) {
    console.error("Daily-lick coordinator request failed:", err);
    return undefined;
  }
}

async function acquireRefresh(env: Env, kvKey: string): Promise<string | undefined> {
  const response = await requestCoordinator(env, `refresh:${kvKey}`, "/refresh/acquire");
  if (!response?.ok) return undefined;
  return (await response.json() as { token: string }).token;
}

async function releaseRefresh(env: Env, kvKey: string, token: string): Promise<void> {
  await requestCoordinator(env, `refresh:${kvKey}`, "/refresh/release", { headers: { "X-Lick-Lease-Token": token } });
}

async function refreshDailyLick(env: Env, kvKey: string, token: string): Promise<void> {
  try {
    const lick = await generateDailyLick(env);
    const payload = JSON.stringify(lick);
    await env.LICK_STORE.put(kvKey, payload, { expirationTtl: 90000 });
    await env.LICK_STORE.put(LATEST_KEY, payload, { expirationTtl: 90000 });
  } catch (err) {
    console.error("Background daily-lick refresh failed:", err);
  } finally {
    await releaseRefresh(env, kvKey, token);
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kvKey = `daily:${getTodayKey()}`;

  if (context.env.LICK_STORE) {
    // Fresh hit: today's lick exists (cron pre-generated it, or a prior request
    // did). Serve instantly and let it cache until the next UTC midnight.
    const cached = await context.env.LICK_STORE.get(kvKey);
    if (cached) {
      return jsonResponse(
        JSON.parse(cached),
        `public, max-age=${secondsUntilMidnightUTC()}, stale-while-revalidate=86400`,
      );
    }

    // Miss on today's key: serve the newest lick we have (yesterday's, or
    // whatever the latest pointer holds) INSTANTLY, and regenerate today's in
    // the background. Classic stale-while-revalidate — no blocking cold path.
    const stale = await context.env.LICK_STORE.get(LATEST_KEY);
    if (stale) {
      const token = await acquireRefresh(context.env, kvKey);
      if (token) {
        context.waitUntil(refreshDailyLick(context.env, kvKey, token));
      }
      return jsonResponse(
        JSON.parse(stale),
        "public, max-age=60, stale-while-revalidate=86400",
        { "X-Lick-Cache": "stale-revalidating" },
      );
    }
  }

  // True cold start: no cached lick anywhere (first request ever, or KV
  // unavailable). Block and generate on demand.
  try {
    const lick = await generateDailyLick(context.env);
    if (context.env.LICK_STORE) {
      const payload = JSON.stringify(lick);
      await context.env.LICK_STORE.put(kvKey, payload, { expirationTtl: 90000 });
      await context.env.LICK_STORE.put(LATEST_KEY, payload, { expirationTtl: 90000 });
    }
    return jsonResponse(
      lick,
      `public, max-age=${secondsUntilMidnightUTC()}, stale-while-revalidate=86400`,
    );
  } catch (err) {
    console.error("Failed to generate daily lick:", err);
    // Do not cache the fallback — let the next request retry the API.
    return jsonResponse(FALLBACK_LICK, "no-store");
  }
};
