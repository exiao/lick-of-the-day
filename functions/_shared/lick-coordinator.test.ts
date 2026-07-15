import { describe, expect, it, vi } from "vitest";
import { LickCoordinator } from "../../workers/daily-lick-cron/index";

class SerializedStorage {
  private readonly values = new Map<string, unknown>();
  private tail: Promise<void> = Promise.resolve();

  transaction<T>(closure: (txn: {
    get<U>(key: string): Promise<U | undefined>;
    put<U>(key: string, value: U): Promise<void>;
    delete(key: string): Promise<boolean>;
  }) => Promise<T>): Promise<T> {
    const operation = this.tail.then(() => closure({
      get: async <U>(key: string) => this.values.get(key) as U | undefined,
      put: async <U>(key: string, value: U) => { this.values.set(key, value); },
      delete: async (key: string) => this.values.delete(key),
    }));
    this.tail = operation.then(() => undefined);
    return operation;
  }

  async setAlarm(_scheduledTime: number): Promise<void> {}

  async deleteAll(): Promise<void> {
    this.values.clear();
  }
}

describe("LickCoordinator", () => {
  it("atomically admits only ten concurrent requests in one rate-limit window", async () => {
    const coordinator = new LickCoordinator({ storage: new SerializedStorage() });

    const responses = await Promise.all(
      Array.from({ length: 11 }, () => coordinator.fetch(new Request("https://coordinator/rate-limit/admit", { method: "POST" }))),
    );

    expect(responses.filter((response) => response.status === 204)).toHaveLength(10);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
  });

  it("allows exactly one concurrent daily-refresh lease and releases it", async () => {
    const coordinator = new LickCoordinator({ storage: new SerializedStorage() });

    const [first, second] = await Promise.all([
      coordinator.fetch(new Request("https://coordinator/refresh/acquire", { method: "POST" })),
      coordinator.fetch(new Request("https://coordinator/refresh/acquire", { method: "POST" })),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const winner = first.status === 200 ? first : second;
    const { token } = await winner.json() as { token: string };
    await coordinator.fetch(new Request("https://coordinator/refresh/release", {
      method: "POST",
      headers: { "X-Lick-Lease-Token": token },
    }));
    await expect(coordinator.fetch(new Request("https://coordinator/refresh/acquire", { method: "POST" }))).resolves.toMatchObject({ status: 200 });
  });

  it("does not let an expired lease holder release its replacement", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const coordinator = new LickCoordinator({ storage: new SerializedStorage() });
    const first = await coordinator.fetch(new Request("https://coordinator/refresh/acquire", { method: "POST" }));
    const { token } = await first.json() as { token: string };

    vi.advanceTimersByTime(60_001);
    await coordinator.fetch(new Request("https://coordinator/refresh/acquire", { method: "POST" }));
    await coordinator.fetch(new Request("https://coordinator/refresh/release", {
      method: "POST",
      headers: { "X-Lick-Lease-Token": token },
    }));

    await expect(coordinator.fetch(new Request("https://coordinator/refresh/acquire", { method: "POST" }))).resolves.toMatchObject({ status: 409 });
    vi.useRealTimers();
  });
});
