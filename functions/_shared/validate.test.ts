import { describe, expect, it } from "vitest";
import { checkLick } from "./validate";
import { parseAbc, keySignature } from "./abc";
import { FALLBACK_LICK } from "./fallback";
import { buildLickPrompt } from "./prompt";

const GENRES = ["jazz", "blues", "funk", "rnb", "bossa"] as const;

// The reference example embedded in the user prompt is the JSON after the marker.
function promptExample(genre: (typeof GENRES)[number]): Record<string, unknown> {
  const { user } = buildLickPrompt(genre, 4);
  const tail = user.slice(user.indexOf("=== REFERENCE EXAMPLE ==="));
  return JSON.parse(tail.slice(tail.indexOf("{"))) as Record<string, unknown>;
}

function lick(abcBody: string, notes: Array<[string, string]>, extra: Record<string, unknown> = {}) {
  return {
    bars: 1,
    timeSignature: "4/4",
    chords: [{ chord: "C7", bar: 1, beat: 1 }],
    abc: `X:1\nM:4/4\nL:1/8\nK:C\n${abcBody}`,
    notes: notes.map(([pitch, duration]) => ({ pitch, duration })),
    ...extra,
  };
}

describe("checkLick", () => {
  it("accepts the shipped fallback lick", () => {
    expect(checkLick(FALLBACK_LICK, 4)).toEqual({ fatal: [], strict: [] });
  });

  it.each(GENRES)("accepts the %s prompt example (examples must obey their own rules)", (genre) => {
    expect(checkLick(promptExample(genre), 4)).toEqual({ fatal: [], strict: [] });
  });

  it("treats missing notes, unplayable pitches and unknown durations as fatal", () => {
    expect(checkLick({ abc: "X:1" }, 4).fatal).toContain("notes must be a non-empty array");
    const bad = lick("C8|", [["H4", "4n"], ["C4", "3n"]]);
    const { fatal } = checkLick(bad, 1);
    expect(fatal).toEqual([
      'notes[0] has unplayable pitch "H4"',
      'notes[1] has unknown duration "3n"',
    ]);
    expect(checkLick(null, 4).fatal).toHaveLength(1);
  });

  it("flags notes that do not fill the requested bars", () => {
    const short = lick("C2 E2 G2 z|", [["C4", "4n"], ["E4", "4n"], ["G4", "4n"], ["rest", "8n"]]);
    const { fatal, strict } = checkLick(short, 1);
    expect(fatal).toEqual([]);
    expect(strict).toContain("notes last 3.5 beats; 1 bars of 4/4 need 4");
    expect(strict).toContain("abc bar 1 lasts 3.5 beats, expected 4");
  });

  it("flags ABC whose pitches disagree with the notes array", () => {
    // K:F makes B flat, so a plain B is Bb4, not the B4 the notes claim.
    const l = lick("B2 z2 c4|", [["B4", "4n"], ["rest", "4n"], ["C5", "2n"]]);
    l.abc = l.abc.replace("K:C", "K:F");
    expect(checkLick(l, 1).strict).toEqual(["abc disagrees with notes at index 0 (notes: B4 4n)"]);
    l.notes[0].pitch = "Bb4";
    expect(checkLick(l, 1).strict).toEqual([]);
  });

  it("applies bar-scoped accidentals and resets them at the bar line", () => {
    const l = lick("_B2 B2 =B2 B2|B8|", [
      ["Bb4", "4n"], ["Bb4", "4n"], ["B4", "4n"], ["B4", "4n"], ["B4", "1n"],
    ], { bars: 2 });
    expect(checkLick(l, 2).strict).toEqual([]);
  });

  it("flags a note-count mismatch between ABC and notes", () => {
    const l = lick("C4 E4|", [["C4", "2n"], ["E4", "4n"], ["E4", "4n"]]);
    expect(checkLick(l, 1).strict).toContain("abc has 2 notes/rests but notes has 3");
  });

  it("rejects ABC constructs that break the one-note-per-entry mapping", () => {
    const tie = lick("C4- C4|", [["C4", "1n"]]);
    expect(checkLick(tie, 1).strict).toContain("abc: ties are not allowed (one ABC note per notes entry)");
    const grace = lick("{B}c8|", [["C5", "1n"]]);
    expect(checkLick(grace, 1).strict[0]).toMatch(/grace notes/);
    const triplet = lick("(3CDE C6|", [["C4", "1n"]]);
    expect(checkLick(triplet, 1).strict[0]).toMatch(/tuplets/);
  });

  it("flags chord charts the backing track cannot use", () => {
    const l = lick("C8|", [["C4", "1n"]], { chords: [{ chord: "C7", bar: 2, beat: 1 }] });
    expect(checkLick(l, 1).strict).toEqual([
      "chords[0] bar 2 is outside 1-1",
      "no chord at bar 1 beat 1",
    ]);
  });

  it("flags a bars field that disagrees with the request", () => {
    const l = lick("C8|", [["C4", "1n"]], { bars: 4 });
    expect(checkLick(l, 1).strict).toEqual(["bars is 4, expected 1"]);
  });
});

describe("parseAbc", () => {
  it("reads lengths, octaves, broken rhythm and repeats", () => {
    const { bars, errors } = parseAbc('X:1\nM:4/4\nL:1/8\nK:C\n|:"C" C, c\' d/ e/ f3/2 g/ a2|b>c A<B z4:|');
    expect(errors).toEqual([]);
    expect(bars.map((b) => b.map((e) => [e.midi, e.beats]))).toEqual([
      [[48, 0.5], [84, 0.5], [74, 0.25], [76, 0.25], [77, 0.75], [79, 0.25], [81, 1]],
      [[83, 0.75], [72, 0.25], [69, 0.25], [71, 0.75], [null, 2]],
    ]);
  });

  it("derives key signatures for major, minor and modal keys", () => {
    expect(keySignature("Eb")).toMatchObject({ B: -1, E: -1, A: -1, D: 0 });
    expect(keySignature("Bbm")).toMatchObject({ B: -1, E: -1, A: -1, D: -1, G: -1, C: 0 });
    expect(keySignature("D dorian")).toMatchObject({ F: 0, C: 0, B: 0 });
    expect(keySignature("F#m")).toMatchObject({ F: 1, C: 1, G: 1, D: 0 });
  });
});
