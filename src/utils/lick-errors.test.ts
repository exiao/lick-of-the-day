import { describe, it, expect } from "vitest";
import {
  LickRequestError,
  assertEventStream,
  classifyLickError,
  errorFromResponse,
  lickErrorMessage,
  readJsonResponse,
} from "./lick-errors";

const html = "<!doctype html><html><body>app</body></html>";
const htmlRes = (status = 200) =>
  new Response(html, { status, headers: { "Content-Type": "text/html" } });
const jsonRes = (body: unknown, status = 200) => Response.json(body, { status });

async function caught(p: Promise<unknown>): Promise<unknown> {
  try { await p; } catch (e) { return e; }
  throw new Error("expected rejection");
}

describe("readJsonResponse", () => {
  it("parses a JSON 200", async () => {
    await expect(readJsonResponse<{ a: number }>(jsonRes({ a: 1 }))).resolves.toEqual({ a: 1 });
  });

  it("classifies an HTML 200 (Vite SPA fallback) as unavailable with a friendly message", async () => {
    const err = await caught(readJsonResponse(htmlRes()));
    expect(classifyLickError(err)).toBe("unavailable");
    const msg = lickErrorMessage(err, "daily");
    expect(msg).toBe("Lick service unavailable — showing a practice lick instead.");
    expect(msg).not.toMatch(/Unexpected token|doctype|JSON/);
    expect((err as LickRequestError).detail).toContain("<!doctype");
  });

  it("surfaces a JSON error body on 5xx", async () => {
    const err = await caught(readJsonResponse(jsonRes({ error: "Failed to generate lick" }, 502)));
    expect(classifyLickError(err)).toBe("api");
    expect(lickErrorMessage(err, "new")).toContain("Failed to generate lick");
  });

  it("treats malformed JSON with a JSON content-type as a real API error", async () => {
    const res = new Response("{not json", { headers: { "Content-Type": "application/json" } });
    const err = await caught(readJsonResponse(res));
    expect(classifyLickError(err)).toBe("api");
    expect(lickErrorMessage(err, "daily")).not.toMatch(/Unexpected token/);
  });
});

describe("errorFromResponse", () => {
  it("classifies 429 as rate-limited and keeps the server message", async () => {
    const err = await errorFromResponse(
      jsonRes({ error: "Rate limit exceeded. Max 10 requests per hour." }, 429),
    );
    expect(err.kind).toBe("rate-limited");
    expect(lickErrorMessage(err, "new")).toContain("Max 10 requests per hour.");
  });

  it("classifies 404 without a JSON body as unavailable", async () => {
    const err = await errorFromResponse(new Response("", { status: 404 }));
    expect(err.kind).toBe("unavailable");
  });

  it("keeps a JSON-bodied 4xx as a real API error", async () => {
    const err = await errorFromResponse(jsonRes({ error: "Invalid bars. Must be one of: 2, 4, 6, 8" }, 400));
    expect(err.kind).toBe("api");
    expect(err.message).toBe("Invalid bars. Must be one of: 2, 4, 6, 8");
  });

  it("keeps an HTML 5xx as a real API error with the status", async () => {
    const err = await errorFromResponse(htmlRes(503));
    expect(err.kind).toBe("api");
    expect(lickErrorMessage(err, "new")).toContain("HTTP 503");
  });
});

describe("assertEventStream", () => {
  it("accepts SSE", () => {
    expect(() =>
      assertEventStream(new Response("", { headers: { "Content-Type": "text/event-stream; charset=utf-8" } })),
    ).not.toThrow();
  });

  it("rejects an HTML page as unavailable", () => {
    let err: unknown;
    try { assertEventStream(htmlRes()); } catch (e) { err = e; }
    expect(classifyLickError(err)).toBe("unavailable");
  });
});

describe("lickErrorMessage", () => {
  it("treats a fetch network TypeError as unavailable", () => {
    expect(lickErrorMessage(new TypeError("Failed to fetch"), "new")).toBe(
      "Lick service unavailable — the current lick still works.",
    );
  });

  it("hides raw SyntaxError text from users", () => {
    const msg = lickErrorMessage(new SyntaxError(`Unexpected token '<', "<!doctype "... is not valid JSON`), "new");
    expect(msg).not.toMatch(/Unexpected token/);
    expect(msg).toContain("malformed");
  });

  it("surfaces stream errors", () => {
    expect(lickErrorMessage(new Error("Stream ended before completion"), "new")).toContain(
      "Stream ended before completion",
    );
  });
});
