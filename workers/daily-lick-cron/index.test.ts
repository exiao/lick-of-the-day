import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

describe("daily lick cron worker", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back with a descriptive error when Grok returns empty content", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "" } }] }))
      .mockResolvedValueOnce(Response.json({ content: [{ type: "text", text: '{"title":"Fallback"}' }] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(new Request("https://cron.test/trigger", { method: "POST" }), {
      XAI_API_KEY: "xai-key",
      ANTHROPIC_API_KEY: "anthropic-key",
      LICK_STORE: { put },
    } as never);

    expect(response.status).toBe(200);
    // Two writes: the daily:<date> key and the daily:latest pointer (added when
    // the cron worker adopted main's stale-while-revalidate pointer scheme).
    expect(put).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("xAI API returned empty content"));
  });

  it("bounds the Grok request so a stalled provider reaches the fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"title":"Grok"}' } }] }));
    vi.stubGlobal("fetch", fetchMock);

    await worker.fetch(new Request("https://cron.test/trigger", { method: "POST" }), {
      XAI_API_KEY: "xai-key",
      ANTHROPIC_API_KEY: "anthropic-key",
      LICK_STORE: { put: vi.fn().mockResolvedValue(undefined) },
    } as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.ai/v1/chat/completions",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("pre-generates tomorrow's key before the UTC day boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T23:45:00.000Z"));
    const put = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      choices: [{ message: { content: '{"id":"model-id","title":"Tomorrow"}' } }],
    })));

    await worker.scheduled({} as never, {
      XAI_API_KEY: "xai-key",
      ANTHROPIC_API_KEY: "anthropic-key",
      LICK_STORE: { put },
    } as never, {} as never);

    expect(put).toHaveBeenNthCalledWith(
      1,
      "daily:2026-07-17",
      expect.stringContaining('"id":"2026-07-17"'),
      expect.any(Object),
    );
  });
});
