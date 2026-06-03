import type { Lick, Genre } from "../types/lick";
import { extractClosedFields, type PartialLick } from "./partial-json";

// Consume the SSE stream from /api/random and assemble a Lick. Calls
// `onProgress` with the partially-parsed lick as fields arrive (title/key →
// abc → notes), so the UI can paint the sheet music before the full notes
// array finishes. Resolves with the complete, server-validated Lick.
//
// Wire contract (see functions/_shared/sse.ts and src/utils/sse.ts):
//   data: {"text":"<delta>"}              incremental model text
//   event: done\ndata: {"id":"<id>"}      success (carries the canonical id)
//   event: error\ndata: {"error":"<msg>"}  failure
export async function streamLick(
  genre: Genre,
  bars: number,
  onProgress?: (partial: PartialLick) => void,
): Promise<Lick> {
  const res = await fetch("/api/random", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ genre, bars }),
  });

  // Pre-stream validation/rate-limit errors come back as plain JSON.
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch { /* non-JSON error body */ }
    throw new Error(msg);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuf = "";   // raw SSE framing buffer
  let assembled = ""; // accumulated model text (the lick JSON)
  let id = "";
  let errored: string | null = null;
  let done = false;

  const handleEvent = (raw: string) => {
    let event = "message";
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (event === "error") {
      try { errored = (JSON.parse(data) as { error?: string }).error ?? "stream error"; }
      catch { errored = "stream error"; }
      return;
    }
    if (event === "done") {
      try { id = (JSON.parse(data) as { id?: string }).id ?? ""; } catch { /* ignore */ }
      done = true;
      return;
    }
    // default message event: an incremental text delta
    try {
      const delta = (JSON.parse(data) as { text?: string }).text ?? "";
      if (delta) {
        assembled += delta;
        if (onProgress) onProgress(extractClosedFields(assembled));
      }
    } catch { /* ignore malformed frame */ }
  };

  for (;;) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    sseBuf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = sseBuf.indexOf("\n\n")) !== -1) {
      const raw = sseBuf.slice(0, idx);
      sseBuf = sseBuf.slice(idx + 2);
      handleEvent(raw);
    }
  }

  if (errored) throw new Error(errored);
  if (!done) throw new Error("Stream ended before completion");

  const parsed = JSON.parse(assembled) as Omit<Lick, "id">;
  return { id, ...parsed };
}
