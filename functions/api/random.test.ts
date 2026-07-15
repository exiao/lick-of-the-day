import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoordinatorNamespace } from "../_shared/coordinator";
import { checkRateLimit } from "./random";

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
