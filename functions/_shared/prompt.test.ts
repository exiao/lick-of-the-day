import { describe, expect, it } from "vitest";
import { buildLickPrompt } from "./prompt";

const GENRES = ["jazz", "blues", "funk", "rnb", "bossa"] as const;

describe("buildLickPrompt", () => {
  it("keeps the system block identical across requests so prompt caching hits", () => {
    const systems = new Set(GENRES.flatMap((g) => [2, 4, 8].map((b) => buildLickPrompt(g, b).system)));
    expect(systems.size).toBe(1);
  });
});
