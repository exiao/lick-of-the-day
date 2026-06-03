// SSE wire-format helpers for streamed lick generation, shared by the Vercel
// Node handler (api/*) and the frontend. The Cloudflare copy lives in
// functions/_shared/sse.ts (Pages functions can't import from src/). Keep the
// two in sync — same event contract:
//   data: {"text":"<delta>"}              incremental raw model text
//   event: done\ndata: {"id":"<id>"}      terminal success
//   event: error\ndata: {"error":"<msg>"}  terminal failure

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
