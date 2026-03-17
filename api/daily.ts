import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { buildLickPrompt } from "../src/utils/prompt";
import type { Genre, Lick } from "../src/types/lick";
import { FALLBACK_LICK } from "../src/utils/mock-lick";

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

// Simple in-memory cache for serverless (works within a single instance)
const cache = new Map<string, { lick: Lick; expires: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const todayKey = `lick:${getTodayKey()}`;

  // Check cache
  const cached = cache.get(todayKey);
  if (cached && cached.expires > Date.now()) {
    return res.status(200).json(cached.lick);
  }

  // Determine genre for today
  const genre = GENRES[getDayOfYear() % GENRES.length];

  try {
    const client = new Anthropic();
    const { system, user } = buildLickPrompt(genre, 4);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const lick: Lick = { id: getTodayKey(), ...JSON.parse(text) };

    // Cache for 24 hours
    cache.set(todayKey, { lick, expires: Date.now() + 24 * 60 * 60 * 1000 });

    return res.status(200).json(lick);
  } catch (err) {
    console.error("Failed to generate daily lick:", err);
    return res.status(200).json(FALLBACK_LICK);
  }
}
