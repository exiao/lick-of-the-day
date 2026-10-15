import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { buildLickPrompt } from "../functions/_shared/prompt";
import type { Genre, Lick } from "../src/types/lick";
import { FALLBACK_LICK } from "../functions/_shared/fallback";
import { extractJSON } from "../functions/_shared/parse";
import { checkLick, describeIssues } from "../functions/_shared/validate";
import { LICK_MODEL, LICK_MAX_TOKENS } from "../functions/_shared/lick-config";

const GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

// Simple in-memory cache for serverless (works within a single instance)
const cache = new Map<string, { lick: Lick; expires: number } | { expires: number }>();

function fallbackResponse(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Lick-Cache", "fallback");
  return res.status(200).json(FALLBACK_LICK);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const dayKey = getTodayKey();
  const todayKey = `lick:${dayKey}`;

  // Check cache
  const cached = cache.get(todayKey);
  if (cached && cached.expires > Date.now()) {
    return "lick" in cached ? res.status(200).json(cached.lick) : fallbackResponse(res);
  }

  // Determine genre for today
  const genre = GENRES[getDayOfYear() % GENRES.length];

  try {
    const client = new Anthropic();
    const { system, user } = buildLickPrompt(genre, 4);

    const message = await client.messages.create({
      model: LICK_MODEL,
      max_tokens: LICK_MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    }, {
      headers: { "anthropic-beta": "prompt-caching-2024-07-31" },
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = JSON.parse(extractJSON(text));
    const issues = checkLick(parsed, 4);
    if (issues.fatal.length > 0 || issues.strict.length > 0) throw new Error(`Generated lick is unusable: ${describeIssues(issues)}`);
    const lick: Lick = { ...parsed, id: dayKey };

    if (dayKey !== getTodayKey()) res.setHeader("Cache-Control", "no-store");
    // The date key selects the UTC day; expired days are never served.
    cache.set(todayKey, { lick, expires: Date.now() + 24 * 60 * 60 * 1000 });

    return res.status(200).json(lick);
  } catch (err) {
    console.error("Failed to generate daily lick:", err);
    const current = cache.get(todayKey);
    if (!current || current.expires <= Date.now() || !("lick" in current)) {
      cache.set(todayKey, { expires: Date.now() + 300_000 });
    }
    return fallbackResponse(res);
  }
}
