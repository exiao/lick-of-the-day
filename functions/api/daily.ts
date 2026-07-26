import { buildLickPrompt } from "../_shared/prompt";
import { FALLBACK_LICK } from "../_shared/fallback";
import { extractJSON, validateNotes } from "../_shared/parse";
import { STREAM_HEADERS, streamAnthropicText, streamString } from "../_shared/stream";

interface Env {
  ANTHROPIC_API_KEY: string;
  LICK_STORE: KVNamespace;
}

type Genre = "jazz" | "blues" | "funk" | "rnb" | "bossa";
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

/**
 * Streams the day's lick as plain JSON text so the client can render the sheet
 * music the moment the `abc` field arrives, before the large `notes` array
 * finishes. The body is always a stream of the JSON object's characters,
 * whether served from the KV cache or generated on demand, so the client has a
 * single code path.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kvKey = `daily:${getTodayKey()}`;

  // Cache hit: replay the stored JSON as a one-shot stream.
  if (context.env.LICK_STORE) {
    const cached = await context.env.LICK_STORE.get(kvKey);
    if (cached) {
      return new Response(streamString(cached), { headers: STREAM_HEADERS });
    }
  }

  // Cold start: cron hasn't run yet (or KV unavailable) — generate on demand.
  const genre = GENRES[getDayOfYear() % GENRES.length];
  const { system, user } = buildLickPrompt(genre, 4);

  let modelStream: ReadableStream<Uint8Array>;
  try {
    modelStream = await streamAnthropicText(
      context.env.ANTHROPIC_API_KEY,
      "claude-sonnet-4-6",
      system,
      user,
    );
  } catch (err) {
    // Upstream failed before any bytes — serve the fallback as a stream.
    console.error("Failed to start daily lick stream:", err);
    return new Response(streamString(JSON.stringify(FALLBACK_LICK)), { headers: STREAM_HEADERS });
  }

  // Tee: one branch streams to the client, the other assembles the full text so
  // we can validate it and write it to KV once complete.
  const [toClient, toCache] = modelStream.tee();

  context.waitUntil(
    (async () => {
      try {
        const full = await new Response(toCache).text();
        const parsed = JSON.parse(extractJSON(full));
        validateNotes(parsed.notes, parsed.bars ?? 4);
        const lick = { id: getTodayKey(), ...parsed };
        if (context.env.LICK_STORE) {
          await context.env.LICK_STORE.put(kvKey, JSON.stringify(lick), {
            expirationTtl: 90000,
          });
        }
      } catch (err) {
        // Don't cache a bad/partial generation — next request retries.
        console.error("Daily lick post-stream cache write failed:", err);
      }
    })(),
  );

  return new Response(toClient, { headers: STREAM_HEADERS });
};
