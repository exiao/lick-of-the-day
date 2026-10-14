import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_LICK } from "../_shared/fallback";
import type { CoordinatorNamespace } from "../_shared/coordinator";
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

class RefreshCoordinator implements CoordinatorNamespace {
  private acquired = false;
  private readonly token = "test-refresh-token";

  idFromName(name: string): string {
    return name;
  }

  get(id: unknown) {
    void id;
    return {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === "/refresh/acquire") {
          if (this.acquired) return new Response(null, { status: 409 });
          this.acquired = true;
          return Response.json({ token: this.token });
        } else if (path === "/refresh/release") {
          if (new Headers(init?.headers).get("X-Lick-Lease-Token") === this.token) this.acquired = false;
        }
        return new Response(null, { status: 204 });
      },
    };
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GET /api/daily", () => {
  it("expires a fresh daily lick at the next UTC midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T23:59:30.000Z"));
    const store = new MemoryKV();
    await store.put("daily:2026-07-15", JSON.stringify({ ...FALLBACK_LICK, id: "2026-07-15" }));

    const response = await onRequestGet({
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store },
    } as Parameters<typeof onRequestGet>[0]);

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=30, must-revalidate");
  });

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
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store, LICK_COORDINATOR: new RefreshCoordinator() },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    } as Parameters<typeof onRequestGet>[0]);

    expect(response.headers.get("X-Lick-Cache")).toBe("stale-revalidating");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
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
    const fetchMock = vi.fn(async () => Response.json({
      content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const pending: Promise<unknown>[] = [];
    const context = {
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store, LICK_COORDINATOR: new RefreshCoordinator() },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    } as Parameters<typeof onRequestGet>[0];

    await Promise.all([
      onRequestGet(context),
      onRequestGet(context),
    ]);

    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes stale content in the background when no coordinator is bound", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const store = new MemoryKV();
    const stale = { ...FALLBACK_LICK, id: "2026-07-14" };
    await store.put("daily:latest", JSON.stringify(stale));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }],
    })));

    const pending: Promise<unknown>[] = [];
    // No LICK_COORDINATOR binding: acquireRefresh can never return a token, so
    // without the fallback branch today's lick would stay stale forever.
    const response = await onRequestGet({
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    } as Parameters<typeof onRequestGet>[0]);

    expect(response.headers.get("X-Lick-Cache")).toBe("stale-revalidating");
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    await expect(store.get("daily:2026-07-15")).resolves.toContain('"id":"2026-07-15"');
  });

  it("keeps the requested UTC date when generation crosses midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T23:59:59.000Z"));
    const store = new MemoryKV();
    vi.stubGlobal("fetch", vi.fn(async () => {
      vi.setSystemTime(new Date("2026-07-16T00:00:01.000Z"));
      return Response.json({ content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }] });
    }));
    const response = await onRequestGet({
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store },
    } as Parameters<typeof onRequestGet>[0]);
    expect(await response.json()).toMatchObject({ id: "2026-07-15" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse((await store.get("daily:2026-07-15"))!)).toMatchObject({ id: "2026-07-15" });
    expect(await store.get("daily:latest")).toBeNull();
  });

  it("does not serve tomorrow's pre-generated lick before midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T23:50:00.000Z"));
    const store = new MemoryKV();
    await store.put("daily:latest", JSON.stringify({ ...FALLBACK_LICK, id: "2026-07-16" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }],
    })));
    const pending: Promise<unknown>[] = [];
    const response = await onRequestGet({
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    } as Parameters<typeof onRequestGet>[0]);
    expect(await response.json()).toMatchObject({ id: "2026-07-15" });
    expect(response.headers.get("X-Lick-Cache")).not.toBe("fallback");
    await Promise.all(pending);
  });

  it("coalesces concurrent cold starts through the coordinator", async () => {
    const store = new MemoryKV();
    const fetchMock = vi.fn(async () => Response.json({
      content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const context = {
      env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store, LICK_COORDINATOR: new RefreshCoordinator() },
    } as Parameters<typeof onRequestGet>[0];
    const responses = await Promise.all([onRequestGet(context), onRequestGet(context)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fallback = responses.find((response) => response.headers.get("X-Lick-Cache") === "fallback");
    expect(fallback?.headers.get("Cache-Control")).toBe("no-store");
    expect(await fallback?.json()).toEqual(FALLBACK_LICK);
  });
  it.each([
    [false, false], [false, true], [true, false], [true, true],
  ])("suppresses failed daily retries and recovers after cooldown (stale=%s, coordinator=%s)", async (stale, coordinated) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const store = new MemoryKV();
    const invalid = { ...FALLBACK_LICK, id: "2026-07-15", notes: FALLBACK_LICK.notes.slice(1) };
    const previous = { ...FALLBACK_LICK, id: "2026-07-14" };
    await store.put("daily:2026-07-15", JSON.stringify(invalid));
    await store.put("daily:latest", JSON.stringify(stale ? previous : invalid));
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => {
        vi.advanceTimersByTime(60_001); // Cooldown starts after a slow generation fails.
        return Response.json({ content: [{ type: "text", text: JSON.stringify(invalid) }] });
      })
      .mockImplementation(async () => Response.json({ content: [{ type: "text", text: JSON.stringify(invalid) }] }));
    vi.stubGlobal("fetch", fetchMock);
    const pending: Promise<unknown>[] = [];
    const context = { env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store, ...(coordinated ? { LICK_COORDINATOR: new RefreshCoordinator() } : {}) }, waitUntil: (p: Promise<unknown>) => pending.push(p) } as Parameters<typeof onRequestGet>[0];
    for (let i = 0; i < 5; i++) {
      const response = await onRequestGet(context);
      await Promise.all(pending.splice(0));
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual(stale ? previous : FALLBACK_LICK);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await store.get("daily:latest")).toBe(JSON.stringify(stale ? previous : invalid));
    await store.put("daily:2026-07-15", JSON.stringify({ ...FALLBACK_LICK, id: "2026-07-15" }));
    const duringCooldown = await onRequestGet(context);
    expect(await duringCooldown.json()).toEqual({ ...FALLBACK_LICK, id: "2026-07-15" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await store.put("daily:2026-07-15", JSON.stringify(invalid));
    vi.advanceTimersByTime(300_001);
    fetchMock.mockImplementation(async () => Response.json({ content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }] }));
    await onRequestGet(context);
    await Promise.all(pending.splice(0));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const recovered = await onRequestGet(context);
    expect(await recovered.json()).toEqual({ ...FALLBACK_LICK, id: "2026-07-15" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the uncached fallback if writing a failure cooldown also fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ content: [{ type: "text", text: JSON.stringify({ ...FALLBACK_LICK, notes: FALLBACK_LICK.notes.slice(1) }) }] })));
    const response = await onRequestGet({ env: { ANTHROPIC_API_KEY: "test", LICK_STORE: { get: async () => null, put: async () => { throw new Error("KV unavailable"); } } } } as Parameters<typeof onRequestGet>[0]);
    expect(await response.json()).toEqual(FALLBACK_LICK);
    expect(response.headers.get("X-Lick-Cache")).toBe("fallback");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([
    ["malformed JSON", "{broken"],
    ["invalid notes", JSON.stringify({ ...FALLBACK_LICK, id: "2026-07-15", notes: FALLBACK_LICK.notes.slice(1) })],
  ])("recovers and persists a valid daily lick after %s in both cache entries", async (_kind, cached) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const store = new MemoryKV();
    await store.put("daily:2026-07-15", cached);
    await store.put("daily:latest", cached);
    const fetchMock = vi.fn(async () => Response.json({ content: [{ type: "text", text: JSON.stringify(FALLBACK_LICK) }] }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await onRequestGet({ env: { ANTHROPIC_API_KEY: "test", LICK_STORE: store } } as Parameters<typeof onRequestGet>[0]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...FALLBACK_LICK, id: "2026-07-15" });
    expect(JSON.parse((await store.get("daily:2026-07-15"))!)).toMatchObject({ id: "2026-07-15" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("X-Lick-Cache")).not.toBe("fallback");
  });

});
