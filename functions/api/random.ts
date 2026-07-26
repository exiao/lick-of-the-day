import { buildLickPrompt } from "../_shared/prompt";
import { LICK_MODEL, LICK_MAX_TOKENS } from "../_shared/lick-config";
import { STREAM_HEADERS, streamAnthropicText } from "../_shared/stream";

interface Env {
  ANTHROPIC_API_KEY: string;
}

const VALID_GENRES = new Set(["jazz", "blues", "funk", "rnb", "bossa"]);
const VALID_BARS = new Set([2, 4, 6, 8]);

// Simple rate limiting per IP (in-memory, resets on isolate restart).
// TODO: Move to KV or D1 for cross-isolate persistence.
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const ip = context.request.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Rate limit exceeded. Max 10 requests per hour." },
      { status: 429 }
    );
  }

  let genre: string | undefined;
  let bars: number | undefined;
  try {
    const body = (await context.request.json()) as { genre?: string; bars?: number };
    genre = body.genre;
    bars = body.bars;
  } catch {
    return Response.json({ error: "Invalid or missing JSON body" }, { status: 400 });
  }

  if (!genre || !VALID_GENRES.has(genre)) {
    return Response.json(
      { error: "Invalid genre. Must be one of: jazz, blues, funk, rnb, bossa" },
      { status: 400 }
    );
  }

  if (!bars || !VALID_BARS.has(bars)) {
    return Response.json(
      { error: "Invalid bars. Must be one of: 2, 4, 6, 8" },
      { status: 400 }
    );
  }

  try {
    const { system, user } = buildLickPrompt(genre as "jazz" | "blues" | "funk" | "rnb" | "bossa", bars);

    const modelStream = await streamAnthropicText(
      context.env.ANTHROPIC_API_KEY,
      LICK_MODEL,
      system,
      user,
      LICK_MAX_TOKENS,
    );

    // Stream the raw model JSON to the client. The client assembles and
    // validates it (and assigns its own id); the sheet renders as soon as the
    // `abc` field closes, before the notes array finishes.
    return new Response(modelStream, { headers: STREAM_HEADERS });
  } catch (err) {
    console.error("Failed to generate random lick:", err);
    return Response.json({ error: "Failed to generate lick", detail: String(err) }, { status: 500 });
  }
};
