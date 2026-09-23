import { describe, it, expect } from "vitest";
import { CURATED_LICKS } from "./curated-licks";
import { FALLBACK_LICK } from "./mock-lick";
import { checkLick } from "../test/lick-checks";

// Validates that each hand-written lick's ABC notation, notes array and chord
// chart describe the same music (checks live in src/test/lick-checks.ts).

describe("curated licks", () => {
  for (const { level, lick } of CURATED_LICKS) {
    describe(`level ${level}: ${lick.id}`, () => checkLick(lick, { rangeCheck: true, finalChordTone: true }));
  }

  it("levels run 1..n in order, licks are 4 bars and tunes 8", () => {
    expect(CURATED_LICKS.map(c => c.level)).toEqual(CURATED_LICKS.map((_, i) => i + 1));
    for (const c of CURATED_LICKS) expect(c.lick.bars, c.lick.id).toBe(c.kind === "tune" ? 8 : 4);
    expect(CURATED_LICKS.some(c => c.kind === "tune")).toBe(true);
  });
});

// The fallback predates the curated rules: it dips to Ab3 and ends on Eb (the 11th) over Bb7,
// anticipating the tonic. Range and final-chord-tone checks are exempt; alignment still applies.
describe(`fallback lick: ${FALLBACK_LICK.id}`, () =>
  checkLick(FALLBACK_LICK, { rangeCheck: false, finalChordTone: false }));
