// Shared helpers for streaming lick generation as Server-Sent Events.
//
// Wire contract (identical on Cloudflare Pages and Vercel Node):
//   data: {"text":"<delta>"}     incremental raw model text
//   event: done\ndata: {"id":"<id>"}   terminal success
//   event: error\ndata: {"error":"<msg>"}  terminal failure
//
// The server forwards Anthropic's text deltas verbatim; the client accumulates
// them and runs the partial-JSON parser. Errors that occur AFTER the 200/SSE
// headers are sent are signalled via the `error` event (status can't change).

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

export function sseData(text: string): string {
  return `data: ${JSON.stringify({ text })}\n\n`;
}

export function sseDone(id: string): string {
  return `event: done\ndata: ${JSON.stringify({ id })}\n\n`;
}

export function sseError(message: string): string {
  return `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`;
}

// Pull the text out of one Anthropic SSE `data:` payload line. Returns the
// delta text for content_block_delta events, or null for everything else.
export function anthropicDeltaText(jsonLine: string): string | null {
  try {
    const evt = JSON.parse(jsonLine) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
      return evt.delta.text ?? "";
    }
  } catch {
    /* keep-alive ping or non-JSON line */
  }
  return null;
}

// Incrementally splits a raw SSE byte stream into complete `data:` JSON payloads.
// Anthropic frames each event as `event: <type>\ndata: <json>\n\n`. We only need
// the data lines. Feed chunks in; get back any newly-completed data payloads.
export class AnthropicSSEParser {
  private buf = "";

  push(chunk: string): string[] {
    this.buf += chunk;
    const out: string[] = [];
    let idx: number;
    // Events are separated by a blank line.
    while ((idx = this.buf.indexOf("\n\n")) !== -1) {
      const rawEvent = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("data:")) out.push(line.slice(5).trim());
      }
    }
    return out;
  }
}
