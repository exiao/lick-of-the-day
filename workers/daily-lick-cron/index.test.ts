import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

describe("daily lick cron worker", () => {
  afterEach(() => {
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
    expect(put).toHaveBeenCalledOnce();
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
});
