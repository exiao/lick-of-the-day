import { describe, expect, it } from "vitest";
import { buildLickPrompt } from "./prompt";
import { buildLickPrompt as buildClientMirror } from "../../src/utils/prompt";

const GENRES = ["jazz", "blues", "funk", "rnb", "bossa"] as const;

describe("buildLickPrompt", () => {
  // functions/_shared/prompt.ts is a hand-kept copy of src/utils/prompt.ts (the
  // eval harness dumps the src copy), so a drift would make evals measure a
  // prompt production never sends.
  it.each(GENRES)("matches the src/utils mirror for %s", (genre) => {
    for (const bars of [2, 4, 6, 8]) {
      expect(buildLickPrompt(genre, bars)).toEqual(buildClientMirror(genre, bars));
    }
  });

  it("keeps the system block identical across requests so prompt caching hits", () => {
    const systems = new Set(GENRES.flatMap((g) => [2, 4, 8].map((b) => buildLickPrompt(g, b).system)));
    expect(systems.size).toBe(1);
  });
});
