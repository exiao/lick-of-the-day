import { describe, expect, it } from "vitest";
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

    expect([first.status, second.status].sort()).toEqual([204, 409]);
    await coordinator.fetch(new Request("https://coordinator/refresh/release", { method: "POST" }));
    await expect(coordinator.fetch(new Request("https://coordinator/refresh/acquire", { method: "POST" }))).resolves.toMatchObject({ status: 204 });
  });
});
