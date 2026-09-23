import { describe, expect, it } from "vitest";
import { suggestPitch } from "./suggest";
import { parsePitch } from "../utils/music";

const chords = [
  { chord: "Gm7", bar: 1, beat: 1 },
  { chord: "C7", bar: 1, beat: 3 },
];
const pc = (p: string) => parsePitch(p).midi % 12;

describe("suggestPitch", () => {
  it("picks a chord tone of the chord active at the step", () => {
    expect([7, 10, 2, 5]).toContain(pc(suggestPitch(chords, 4, 2, 65)));
    expect([0, 4, 7, 10]).toContain(pc(suggestPitch(chords, 4, 9, 65)));
  });

  it("lands near the previous note, in C4..E5", () => {
    const midi = parsePitch(suggestPitch(chords, 4, 9, 72)).midi;
    expect(Math.abs(midi - 72)).toBeLessThanOrEqual(3);
    for (const prev of [30, 100, null]) {
      const m = parsePitch(suggestPitch(chords, 4, 0, prev)).midi;
      expect(m).toBeGreaterThanOrEqual(60);
      expect(m).toBeLessThanOrEqual(76);
    }
  });

  it("moves off a repeated note when a neighbouring chord tone is close", () => {
    // Previous note G4 (a Gm7 chord tone): suggest a different tone.
    expect(suggestPitch(chords, 4, 1, 67)).not.toBe("G4");
  });

  it("falls back to the previous pitch without chords", () => {
    expect(suggestPitch([], 4, 3, 64)).toBe("E4");
  });
});
