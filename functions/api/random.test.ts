import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./random";

class MemoryKV {
  private readonly entries = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkRateLimit", () => {
  it("persists the hourly limit across calls that share KV", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 6, 15, 12, 0, 0));
    const store = new MemoryKV() as unknown as KVNamespace;

    for (let request = 0; request < 10; request += 1) {
      await expect(checkRateLimit(store, "203.0.113.9")).resolves.toBe(true);
    }

    await expect(checkRateLimit(store, "203.0.113.9")).resolves.toBe(false);
  });

  it("fails open when KV is temporarily unavailable", async () => {
    const store = {
      get: vi.fn().mockRejectedValue(new Error("KV unavailable")),
      put: vi.fn(),
    } as unknown as KVNamespace;

    await expect(checkRateLimit(store, "203.0.113.9")).resolves.toBe(true);
  });
});
