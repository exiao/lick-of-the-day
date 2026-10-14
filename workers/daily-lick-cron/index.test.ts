import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import { FALLBACK_LICK } from "../../functions/_shared/fallback";

// A lick that passes checkLick (fatal + strict), serialized as model output.
const VALID = JSON.stringify(FALLBACK_LICK);
// Playable but off-grid: one note dropped, so notes no longer fill 4 bars and
// no longer match the ABC.
const OFF_GRID = JSON.stringify({ ...FALLBACK_LICK, title: "Off grid", notes: FALLBACK_LICK.notes.slice(1) });
const grokReply = (content: string) => Response.json({ choices: [{ message: { content } }] });
const haikuReply = (text: string) => Response.json({ content: [{ type: "text", text }] });
const ENV = (put: ReturnType<typeof vi.fn>) => ({
  CRON_TRIGGER_TOKEN: "trigger-token",
  XAI_API_KEY: "xai-key",
  ANTHROPIC_API_KEY: "anthropic-key",
  LICK_STORE: { put },
}) as never;
const trigger = () => new Request("https://cron.test/trigger", { method: "POST", headers: { Authorization: "Bearer trigger-token" } });

describe("daily lick cron worker", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([undefined, "wrong-token"])("denies an unauthorized trigger before calling providers (%s)", async (token) => {
    const put = vi.fn();
    const fetchMock = vi.fn(async () => grokReply(VALID));
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://cron.test/trigger", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }), ENV(put));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("falls back with a descriptive error when Grok returns empty content", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "" } }] }))
      .mockResolvedValueOnce(haikuReply(VALID));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(new Request("https://cron.test/trigger", { method: "POST", headers: { Authorization: "Bearer trigger-token" } }), {
      CRON_TRIGGER_TOKEN: "trigger-token",
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
    const fetchMock = vi.fn().mockResolvedValue(grokReply(VALID));
    vi.stubGlobal("fetch", fetchMock);

    await worker.fetch(new Request("https://cron.test/trigger", { method: "POST", headers: { Authorization: "Bearer trigger-token" } }), {
      CRON_TRIGGER_TOKEN: "trigger-token",
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(grokReply(JSON.stringify({ ...FALLBACK_LICK, id: "model-id" }))));

    await worker.scheduled({} as never, {
      CRON_TRIGGER_TOKEN: "trigger-token",
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

  it("regenerates with haiku when grok's lick is off-grid", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(grokReply(OFF_GRID))
      .mockResolvedValueOnce(haikuReply(VALID));
    vi.stubGlobal("fetch", fetchMock);

    await worker.fetch(trigger(), ENV(put));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[0][1]).toContain(`"title":"${FALLBACK_LICK.title}"`);
  });

  it("does not overwrite cached music when no manual generation attempt is fully valid", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(grokReply('{"title":"no notes"}'))
      .mockResolvedValueOnce(haikuReply(OFF_GRID))
      .mockResolvedValueOnce(haikuReply(OFF_GRID));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(trigger(), ENV(put));

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(put).not.toHaveBeenCalled();
  });

  it("fails the scheduled run without overwriting cached music when every attempt is unplayable", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(grokReply('{"title":"no notes"}'))
      .mockResolvedValue(haikuReply('{"title":"no notes"}')));

    await expect(worker.scheduled({} as never, ENV(put), {} as never)).rejects.toThrow('No valid daily lick');
    expect(put).not.toHaveBeenCalled();
  });
});
