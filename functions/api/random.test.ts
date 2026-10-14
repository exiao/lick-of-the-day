import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoordinatorNamespace } from "../_shared/coordinator";
import { FALLBACK_LICK } from "../_shared/fallback";
import { checkRateLimit, onRequestPost } from "./random";

class RateLimitCoordinator implements CoordinatorNamespace {
  private count = 0;
  private tail: Promise<void> = Promise.resolve();

  idFromName(name: string): string {
    return name;
  }

  get(id: unknown) {
    void id;
    return {
      fetch: (input: RequestInfo | URL) => {
        void input;
        const operation = this.tail.then(() => {
          if (this.count >= 10) return new Response(null, { status: 429 });
          this.count += 1;
          return new Response(null, { status: 204 });
        });
        this.tail = operation.then(() => undefined);
        return operation;
      },
    };
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("checkRateLimit", () => {
  it("persists the hourly limit across calls that share the coordinator", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 6, 15, 12, 0, 0));
    const coordinator = new RateLimitCoordinator();

    for (let request = 0; request < 10; request += 1) {
      await expect(checkRateLimit(coordinator, "203.0.113.9")).resolves.toBe(true);
    }

    await expect(checkRateLimit(coordinator, "203.0.113.9")).resolves.toBe(false);
  });

  it("does not admit more than ten concurrent requests from one IP", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 6, 15, 12, 0, 0));
    const coordinator = new RateLimitCoordinator();

    const admitted = await Promise.all(
      Array.from({ length: 11 }, () => checkRateLimit(coordinator, "203.0.113.9")),
    );

    expect(admitted.filter(Boolean)).toHaveLength(10);
  });

  it("fails open when the coordinator is temporarily unavailable", async () => {
    const coordinator = {
      idFromName: vi.fn(),
      get: vi.fn(() => ({ fetch: vi.fn().mockRejectedValue(new Error("Coordinator unavailable")) })),
    } as unknown as CoordinatorNamespace;

    await expect(checkRateLimit(coordinator, "203.0.113.9")).resolves.toBe(true);
  });
});

describe("POST /api/random", () => {
  it.each(["error", "truncated"])("does not declare success after an upstream %s stream", async (ending) => {
    const delta = { type: "content_block_delta", delta: { type: "text_delta", text: JSON.stringify(FALLBACK_LICK) } };
    const frames = `data: ${JSON.stringify(delta)}\n\n` + (ending === "error"
      ? 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n'
      : "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(frames)));
    const response = await onRequestPost({
      request: new Request("https://app.test/api/random", { method: "POST", body: JSON.stringify({ genre: "jazz", bars: 4 }) }),
      env: { ANTHROPIC_API_KEY: "test" },
    } as Parameters<typeof onRequestPost>[0]);
    const body = await response.text();
    expect(body).toContain("event: error");
    expect(body).not.toContain("event: done");
  });

  it("completes a valid provider stream", async () => {
    const delta = { type: "content_block_delta", delta: { type: "text_delta", text: JSON.stringify(FALLBACK_LICK) } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`data: ${JSON.stringify(delta)}\n\ndata: {"type":"message_stop"}\n\n`)));
    const response = await onRequestPost({
      request: new Request("https://app.test/api/random", { method: "POST", body: JSON.stringify({ genre: "jazz", bars: 4 }) }),
      env: { ANTHROPIC_API_KEY: "test" },
    } as Parameters<typeof onRequestPost>[0]);
    expect(await response.text()).toContain("event: done");
  });
  it("rejects notation that disagrees with playback before declaring success", async () => {
    const delta = { type: "content_block_delta", delta: { type: "text_delta", text: JSON.stringify({ ...FALLBACK_LICK, notes: FALLBACK_LICK.notes.slice(1) }) } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`data: ${JSON.stringify(delta)}\n\ndata: {"type":"message_stop"}\n\n`)));
    const response = await onRequestPost({
      request: new Request("https://app.test/api/random", { method: "POST", body: JSON.stringify({ genre: "jazz", bars: 4 }) }),
      env: { ANTHROPIC_API_KEY: "test" },
    } as Parameters<typeof onRequestPost>[0]);
    const body = await response.text();
    expect(body).toContain("event: error");
    expect(body).not.toContain("event: done");
  });

});
