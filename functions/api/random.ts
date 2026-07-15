import { buildLickPrompt } from "../_shared/prompt";
import { extractJSON, validateNotes } from "../_shared/parse";
import { LICK_MODEL, LICK_MAX_TOKENS } from "../_shared/lick-config";
import { SSE_HEADERS, sseData, sseDone, sseError, AnthropicSSEParser, anthropicDeltaText } from "../_shared/sse";

interface Env {
  ANTHROPIC_API_KEY: string;
  LICK_STORE: KVNamespace;
}

const VALID_GENRES = new Set(["jazz", "blues", "funk", "rnb", "bossa"]);
const VALID_BARS = new Set([2, 4, 6, 8]);

const RATE_LIMIT_MAX = 10; // requests
const RATE_LIMIT_WINDOW_SEC = 60 * 60; // per hour

// Fixed-window rate limit backed by KV so the counter is shared across isolates
// (an in-memory Map resets on every isolate spin-up, letting a client exceed the
// limit by hitting fresh isolates). The window key rotates each hour and the KV
// entry auto-expires, so no cleanup is needed. KV is eventually consistent, so
// under a burst from many colocated edge locations a client may slip a few extra
// requests through — acceptable for abuse-throttling, unlike the per-isolate Map
// which reset the count to zero on any cold start.
export async function checkRateLimit(store: KVNamespace | undefined, ip: string): Promise<boolean> {
  if (!store) return true; // KV unbound (e.g. local dev) — fail open, don't block.
  try {
    const window = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SEC);
    const key = `rl:${ip}:${window}`;
    const current = parseInt((await store.get(key)) ?? "0", 10) || 0;
    if (current >= RATE_LIMIT_MAX) return false;
    // TTL covers the rest of this window plus a full window of slack so the entry
    // never expires mid-window and reset the count early.
    await store.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SEC * 2 });
    return true;
  } catch (err) {
    console.error("Rate limiting check failed, failing open:", err);
    return true;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const ip = context.request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkRateLimit(context.env.LICK_STORE, ip))) {
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

  const { system, user } = buildLickPrompt(genre as "jazz" | "blues" | "funk" | "rnb" | "bossa", bars);

  // Abort the upstream request if the client disconnects.
  const abort = new AbortController();

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: abort.signal,
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
  } catch (err) {
    // Network failure before any streaming — return a real error status, the
    // same shape the non-streaming handler used to. (Parity with Vercel, which
    // also returns a 502 status when nothing has streamed yet.)
    console.error("Anthropic fetch failed:", err);
    return Response.json({ error: "Failed to generate lick" }, { status: 502 });
  }

  // Upstream errors before streaming also return a real status, not an SSE 200.
  if (!upstream.ok || !upstream.body) {
    const detail = upstream.body ? await upstream.text() : "no response body";
    console.error("Anthropic API error:", upstream.status, detail);
    return Response.json({ error: "Anthropic API error", status: upstream.status }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const parser = new AnthropicSSEParser();
  let assembled = "";
  const reader = upstream.body.getReader();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (s: string) => {
        if (!closed) controller.enqueue(encoder.encode(s));
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of parser.push(decoder.decode(value, { stream: true }))) {
            const delta = anthropicDeltaText(line);
            if (delta) {
              assembled += delta;
              safeEnqueue(sseData(delta));
            }
          }
        }
        // Validate the assembled JSON before declaring success.
        const parsed = JSON.parse(extractJSON(assembled));
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid JSON structure received from model");
        }
        validateNotes(parsed.notes, parsed.bars ?? bars);
        const id = `${new Date().toISOString().split("T")[0]}-${Date.now()}`;
        safeEnqueue(sseDone(id));
      } catch (err) {
        console.error("Stream failed:", err);
        safeEnqueue(sseError("Failed to generate lick"));
      } finally {
        if (!closed) controller.close();
      }
    },
    // Client disconnected: stop reading and abort the upstream generation.
    cancel(reason) {
      closed = true;
      abort.abort(reason);
      reader.cancel(reason).catch(() => { /* already closed */ });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};
