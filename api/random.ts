import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { buildLickPrompt } from "../src/utils/prompt";
import type { Genre } from "../src/types/lick";
import { LICK_MODEL, LICK_MAX_TOKENS } from "../src/utils/lick-config";
import { extractJSON, validateNotes } from "../src/utils/parse";
import { SSE_HEADERS, sseData, sseDone, sseError } from "../src/utils/sse";

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

  const { system, user } = buildLickPrompt(genre as Genre, bars);
  const client = new Anthropic();

  const stream = client.messages.stream(
    {
      model: LICK_MODEL,
      max_tokens: LICK_MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    },
    { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } },
  );

  // Abort the upstream generation if the client goes away, so we don't keep
  // burning tokens writing to a dead socket. Listen on the response, not the
  // request: on Node's IncomingMessage, `close` fires once the request body is
  // fully read (normal for a POST), which would abort healthy requests. The
  // response `close` fires when the underlying connection is actually torn down.
  let clientGone = false;
  const onClose = () => {
    clientGone = true;
    stream.abort();
  };
  res.on("close", onClose);

  // Defer the SSE 200 until the first delta. Until then, an Anthropic setup or
  // auth failure can still surface as a real error status (parity with the
  // Cloudflare handler, which returns 502 before streaming on upstream errors).
  let headersSent = false;
  const ensureHeaders = () => {
    if (!headersSent) {
      res.writeHead(200, SSE_HEADERS);
      headersSent = true;
    }
  };

  try {
    stream.on("text", (delta) => {
      if (clientGone) return;
      ensureHeaders();
      res.write(sseData(delta));
    });

    const finalMessage = await stream.finalMessage();
    if (clientGone) {
      res.end();
      return;
    }
    const text = finalMessage.content[0]?.type === "text" ? finalMessage.content[0].text : "";
    // Validate the assembled lick the same way Cloudflare does before success.
    const parsed = JSON.parse(extractJSON(text));
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid JSON structure received from model");
    }
    validateNotes(parsed.notes, parsed.bars ?? bars);

    ensureHeaders();
    const id = `${new Date().toISOString().split("T")[0]}-${Date.now()}`;
    res.write(sseDone(id));
    res.end();
  } catch (err) {
    if (clientGone) return;
    console.error("Failed to generate random lick:", err);
    if (!headersSent) {
      // Nothing streamed yet — return a normal error status.
      return res.status(502).json({ error: "Failed to generate lick" });
    }
    // Mid-stream failure — signal via the SSE error event.
    res.write(sseError("Failed to generate lick"));
    res.end();
  } finally {
    res.off("close", onClose);
  }
}
