import { buildLickPrompt } from "../_shared/prompt";
import { extractJSON, validateNotes } from "../_shared/parse";
import { LICK_MODEL, LICK_MAX_TOKENS } from "../_shared/lick-config";
import { SSE_HEADERS, sseData, sseDone, sseError, AnthropicSSEParser, anthropicDeltaText } from "../_shared/sse";

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
    return Response.json({ error: "Rate limit exceeded. Max 10 requests per hour." }, { status: 429 });
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
    return Response.json({ error: "Invalid genre. Must be one of: jazz, blues, funk, rnb, bossa" }, { status: 400 });
  }
  if (!bars || !VALID_BARS.has(bars)) {
    return Response.json({ error: "Invalid bars. Must be one of: 2, 4, 6, 8" }, { status: 400 });
  }

  // From here we stream. Validation errors above already returned plain JSON.
  const { system, user } = buildLickPrompt(genre as "jazz" | "blues" | "funk" | "rnb" | "bossa", bars);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": context.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: LICK_MODEL,
      max_tokens: LICK_MAX_TOKENS,
      stream: true,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = upstream.body ? await upstream.text() : "no response body";
    console.error("Anthropic API error:", upstream.status, detail);
    return Response.json({ error: "Anthropic API error", status: upstream.status }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const parser = new AnthropicSSEParser();
  let assembled = "";

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const dataLines = parser.push(decoder.decode(value, { stream: true }));
          for (const line of dataLines) {
            const delta = anthropicDeltaText(line);
            if (delta) {
              assembled += delta;
              controller.enqueue(encoder.encode(sseData(delta)));
            }
          }
        }
        // Validate the assembled JSON before declaring success.
        const parsed = JSON.parse(extractJSON(assembled));
        validateNotes(parsed.notes, parsed.bars ?? bars);
        const id = `${new Date().toISOString().split("T")[0]}-${Date.now()}`;
        controller.enqueue(encoder.encode(sseDone(id)));
      } catch (err) {
        console.error("Stream failed:", err);
        controller.enqueue(encoder.encode(sseError("Failed to generate lick")));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};
