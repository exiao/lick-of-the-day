// Classify failures from the lick API (/api/daily, /api/random) so the UI can
// tell "the endpoint isn't there" (plain `vite` dev with no Pages Functions, a
// proxy serving index.html, network down) apart from genuine API failures
// (rate limits, validation errors, 5xx). The former gets a friendly message;
// the latter keeps its server-provided detail. Raw detail is always kept on the
// error for console logging.

export type LickErrorKind =
  /** Endpoint missing / non-JSON (e.g. HTML) response / network unreachable. */
  | "unavailable"
  /** HTTP 429 from the rate limiter. */
  | "rate-limited"
  /** Any other real API failure (4xx/5xx, stream error, malformed lick). */
  | "api";

export class LickRequestError extends Error {
  readonly kind: LickErrorKind;
  readonly status?: number;
  /** Developer-facing detail (content-type, body snippet, etc.). */
  readonly detail?: string;

  constructor(kind: LickErrorKind, message: string, opts: { status?: number; detail?: string } = {}) {
    super(message);
    this.name = "LickRequestError";
    this.kind = kind;
    this.status = opts.status;
    this.detail = opts.detail;
  }
}

export type LickErrorContext = "daily" | "new";

function contentType(res: Response): string {
  return res.headers.get("content-type") ?? "";
}

function snippet(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

/** Build a classified error from a non-2xx response. Consumes the body. */
export async function errorFromResponse(res: Response): Promise<LickRequestError> {
  const ct = contentType(res);
  let text = "";
  try { text = await res.text(); } catch { /* body unreadable */ }

  let serverMsg: string | undefined;
  if (ct.includes("json") || /^\s*[{[]/.test(text)) {
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (typeof body.error === "string" && body.error) serverMsg = body.error;
    } catch { /* not actually JSON */ }
  }

  const detail = `HTTP ${res.status} ${ct || "(no content-type)"}: ${snippet(text)}`;
  if (res.status === 429) {
    return new LickRequestError("rate-limited", serverMsg ?? "Too many requests.", { status: 429, detail });
  }
  if (serverMsg) return new LickRequestError("api", serverMsg, { status: res.status, detail });
  // No JSON error body: a 404/405 means the function isn't deployed/running
  // (e.g. plain Vite dev). Other statuses (5xx HTML pages, etc.) are real.
  if (res.status === 404 || res.status === 405) {
    return new LickRequestError("unavailable", `HTTP ${res.status}`, { status: res.status, detail });
  }
  return new LickRequestError("api", `HTTP ${res.status}`, { status: res.status, detail });
}

/** Parse a successful JSON response, rejecting HTML/non-JSON bodies as "unavailable". */
export async function readJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorFromResponse(res);
  const ct = contentType(res);
  const text = await res.text();
  if (!ct.includes("json")) {
    throw new LickRequestError("unavailable", "Non-JSON response", {
      status: res.status,
      detail: `HTTP ${res.status} ${ct || "(no content-type)"}: ${snippet(text)}`,
    });
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new LickRequestError("api", "Invalid JSON response", {
      status: res.status,
      detail: `HTTP ${res.status} ${ct}: ${snippet(text)}`,
    });
  }
}

/** Reject a 2xx response that isn't an SSE stream (e.g. an HTML fallback page). */
export function assertEventStream(res: Response): void {
  const ct = contentType(res);
  if (!ct.includes("text/event-stream")) {
    throw new LickRequestError("unavailable", "Non-stream response", {
      status: res.status,
      detail: `HTTP ${res.status} ${ct || "(no content-type)"}`,
    });
  }
}

/** Classify any thrown value (fetch TypeError, SyntaxError, LickRequestError, …). */
export function classifyLickError(err: unknown): LickErrorKind {
  if (err instanceof LickRequestError) return err.kind;
  // fetch() rejects with TypeError when the network/server is unreachable.
  if (err instanceof TypeError) return "unavailable";
  return "api";
}

/** User-facing copy for a lick-loading failure. Never includes raw parser text. */
export function lickErrorMessage(err: unknown, context: LickErrorContext): string {
  const kind = classifyLickError(err);
  if (kind === "unavailable") {
    return context === "daily"
      ? "Lick service unavailable — showing a practice lick instead."
      : "Lick service unavailable — the current lick still works.";
  }

  let reason: string;
  if (err instanceof SyntaxError) reason = "the lick came back malformed";
  else if (err instanceof Error && err.message) reason = err.message;
  else reason = "unknown error";

  if (kind === "rate-limited") {
    return `${reason} The current lick still works; try again later.`;
  }
  return context === "daily"
    ? `Couldn't load today's lick (${reason}) — showing a practice lick instead.`
    : `Couldn't load a new lick (${reason}). The current one still works; try again in a moment.`;
}

/** Log the raw failure for developers and return the user-facing message. */
export function reportLickError(err: unknown, context: LickErrorContext): string {
  const kind = classifyLickError(err);
  const detail = err instanceof LickRequestError && err.detail ? err.detail : undefined;
  const log = kind === "unavailable" ? console.warn : console.error;
  log(`[lick] ${context} lick failed (${kind})`, err, ...(detail ? [detail] : []));
  return lickErrorMessage(err, context);
}
