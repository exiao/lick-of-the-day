import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_LICK } from "../_shared/fallback";
import { onRequestGet } from "./daily";

class MemoryKV {
  private readonly entries = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GET /api/daily", () => {
  it("serves the latest cached lick while it refreshes a missing daily key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const store = new MemoryKV();
    const stale = { ...FALLBACK_LICK, id: "2026-07-14" };
    await store.put("daily:latest", JSON.stringify(stale));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }],
    })));

    const pending: Promise<unknown>[] = [];
    const response = await onRequestGet({
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    } as Parameters<typeof onRequestGet>[0]);

    expect(response.headers.get("X-Lick-Cache")).toBe("stale-revalidating");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=86400");
    await expect(response.json()).resolves.toEqual(stale);
    expect(pending).toHaveLength(1);

    await Promise.all(pending);
    await expect(store.get("daily:2026-07-15")).resolves.toContain('"id":"2026-07-15"');
  });

  it("coalesces stale refreshes while a daily regeneration is in flight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const store = new MemoryKV();
    await store.put("daily:latest", JSON.stringify(FALLBACK_LICK));
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const pending: Promise<unknown>[] = [];
    const context = {
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    } as Parameters<typeof onRequestGet>[0];

    await onRequestGet(context);
    await onRequestGet(context);

    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(store.get("daily:2026-07-15:refresh-lock")).resolves.toBeNull();
  });
});
