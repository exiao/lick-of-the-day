// Streaming helpers shared by the Cloudflare Pages functions.
//
// The wire format between our functions and the browser is deliberately dumb: a
// plain-text stream of the model's JSON characters as they are generated. The
// client accumulates the text and runs the tolerant partial parser
// (src/utils/partial-json.ts) to surface fields as they close. No bespoke SSE
// framing to keep both ends simple and the two code paths (cached vs generated)
// identical.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Prompt caching keeps the large static system block off the per-request bill.
const CACHE_BETA = "prompt-caching-2024-07-31";

export const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

/**
 * Call Anthropic with streaming enabled and return a ReadableStream that emits
 * ONLY the assistant's text deltas (the JSON being generated), decoded from
 * Anthropic's SSE envelope. Throws before returning if the upstream call fails,
 * so callers can fall back cleanly before any bytes are sent to the client.
 */
export async function streamAnthropicText(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens = 2048,
): Promise<ReadableStream<Uint8Array>> {
  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": CACHE_BETA,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      // Cache the static system block (mirrors the non-streaming handlers).
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = upstream.body ? await upstream.text() : "(no body)";
    throw new Error(`Anthropic stream error: ${upstream.status} ${detail}`);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      // Anthropic SSE: events separated by blank lines; we only need the
      // `data:` lines carrying text_delta.
      const lines = buf.split("\n");
      buf = lines.pop() ?? ""; // keep the partial trailing line
      for (const line of lines) {
        const trimmed = line.trimStart();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            controller.enqueue(encoder.encode(evt.delta.text));
          }
        } catch {
          // Ignore non-JSON keepalive lines.
        }
      }
    },
  });

  return upstream.body.pipeThrough(transform);
}

/** A one-shot stream that emits a single already-known string (cache-hit path). */
export function streamString(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}
