import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { buildLickPrompt } from "../src/utils/prompt";
import type { Genre, Lick } from "../src/types/lick";

const VALID_GENRES = new Set(["jazz", "blues", "funk", "rnb", "bossa"]);
const VALID_BARS = new Set([2, 4, 6, 8]);

// Simple rate limiting per IP
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 10) return false;

  entry.count++;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Rate limit exceeded. Max 10 requests per hour." });
  }

  const { genre, bars } = req.body || {};

  if (!genre || !VALID_GENRES.has(genre)) {
    return res.status(400).json({ error: "Invalid genre. Must be one of: jazz, blues, funk, rnb, bossa" });
  }

  if (!bars || !VALID_BARS.has(bars)) {
    return res.status(400).json({ error: "Invalid bars. Must be one of: 2, 4, 6, 8" });
  }

  try {
    const client = new Anthropic();
    const { system, user } = buildLickPrompt(genre as Genre, bars);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const id = `${new Date().toISOString().split("T")[0]}-${Date.now()}`;
    const lick: Lick = { id, ...JSON.parse(text) };

    return res.status(200).json(lick);
  } catch (err) {
    console.error("Failed to generate random lick:", err);
    return res.status(500).json({ error: "Failed to generate lick" });
  }
}
