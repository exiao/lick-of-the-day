import { describe, it, expect } from "vitest";
import abcjs from "abcjs";
import type { Chord, Lick, Note } from "../types/lick";
import { CURATED_LICKS } from "../utils/curated-licks";
import { FALLBACK_LICK } from "../utils/mock-lick";
import { checkLick, noteToMidi, parseAbc } from "../test/lick-checks";
import {
  chordSplitSteps,
  gridToNotes,
  keySignatureAccidentals,
  noteAtStep,
  normalizeGrid,
  notesToAbc,
  notesToGrid,
  setStepPitch,
  stepsPerBar,
  toggleStep,
  transposeStep,
  type Grid,
} from "./grid";

const LICKS: Lick[] = [...CURATED_LICKS.map((c) => c.lick), FALLBACK_LICK];

const STEPS: Record<string, number> = { "16n": 1, "8n": 2, "8n.": 3, "4n": 4, "4n.": 6, "2n": 8, "2n.": 12, "1n": 16 };

/** Pitched onsets of a Note[] as grid steps. */
function pitchedOnsets(notes: Note[]) {
  let cursor = 0;
  const out: { step: number; length: number; pitch: string }[] = [];
  for (const n of notes) {
    if (n.pitch !== "rest") out.push({ step: cursor, length: STEPS[n.duration], pitch: n.pitch });
    cursor += STEPS[n.duration];
  }
  return out;
}

const bpbOf = (ts: string) => stepsPerBar(ts) / 4;

/** Regenerate ABC for `notes` and assert the parsed notation is exactly the notes array (and chords land). */
function expectDisplayMatchesSound(notes: Note[], lick: Pick<Lick, "key" | "timeSignature" | "bars" | "chords">) {
  const abc = notesToAbc(notes, lick);
  const { events, chords, barLines } = parseAbc(abc);
  const bpb = bpbOf(lick.timeSignature);
  expect(events.map(({ midi, beats }) => ({ midi, beats })), abc).toEqual(
    notes.map((n) => ({ midi: n.pitch === "rest" ? null : noteToMidi(n.pitch), beats: STEPS[n.duration] / 4 })),
  );
  expect(notes.reduce((s, n) => s + STEPS[n.duration], 0) / 4).toBe(lick.bars * bpb);
  expect(barLines).toEqual(Array.from({ length: lick.bars }, (_, i) => (i + 1) * bpb));
  expect(chords.map((c) => ({ chord: c.chord, bar: Math.floor(c.onset / bpb) + 1, beat: (c.onset % bpb) + 1 })), abc).toEqual(
    lick.chords.map(({ chord, bar, beat }) => ({ chord, bar, beat })),
  );
  return abc;
}

describe("stepsPerBar", () => {
  it("maps time signatures to 16th steps", () => {
    expect(stepsPerBar("4/4")).toBe(16);
    expect(stepsPerBar("3/4")).toBe(12);
    expect(stepsPerBar("6/8")).toBe(12);
    expect(() => stepsPerBar("nope")).toThrow();
  });
});

describe("curated licks round-trip", () => {
  for (const lick of LICKS) {
    describe(lick.id, () => {
      const grid = notesToGrid(lick.notes, lick.bars, lick.timeSignature);
      const splitAt = chordSplitSteps(lick.chords, lick.timeSignature);

      it("maps onto the grid", () => {
        expect(grid).not.toBeNull();
        expect(grid!.totalSteps).toBe(lick.bars * 16);
      });

      it("gridToNotes reproduces pitched onsets, lengths, pitches and expression", () => {
        const notes = gridToNotes(grid!, { splitAt });
        expect(pitchedOnsets(notes)).toEqual(pitchedOnsets(lick.notes));
        const expr = (ns: Note[]) => ns.filter((n) => n.pitch !== "rest").map((n) => [n.velocity, n.articulation]);
        expect(expr(notes)).toEqual(expr(lick.notes));
      });

      it("regenerated ABC agrees with the notes", () => {
        expectDisplayMatchesSound(gridToNotes(grid!, { splitAt }), lick);
      });
    });
  }
});

// Full lick-checks suite against licks whose ABC was regenerated from their own notes.
for (const lick of LICKS) {
  const abc = notesToAbc(lick.notes, lick);
  describe(`checkLick on regenerated ABC: ${lick.id}`, () =>
    checkLick({ ...lick, abc }, { rangeCheck: false, finalChordTone: false }));
}

describe("notesToGrid", () => {
  it("returns null for off-grid durations", () => {
    expect(notesToGrid([{ pitch: "C4", duration: "32n" }], 1, "4/4")).toBeNull();
    expect(notesToGrid([{ pitch: "C4", duration: "16n." }], 1, "4/4")).toBeNull();
    expect(notesToGrid([{ pitch: "C4", duration: "8t" }], 1, "4/4")).toBeNull();
    expect(notesToGrid([{ pitch: "rest", duration: "wat" }], 1, "4/4")).toBeNull();
    expect(notesToGrid([{ pitch: "H4", duration: "4n" }], 1, "4/4")).toBeNull();
  });

  it("ignores notes beyond the form and clips a note running past it", () => {
    const g = notesToGrid(
      [{ pitch: "rest", duration: "2n." }, { pitch: "C4", duration: "2n" }, { pitch: "D4", duration: "32n" }],
      1, "4/4",
    )!;
    expect(g.notes).toEqual([{ step: 12, length: 4, pitch: "C4" }]);
  });

  it("supports 3/4", () => {
    const notes: Note[] = [
      { pitch: "C4", duration: "4n" }, { pitch: "E4", duration: "4n" }, { pitch: "G4", duration: "4n" },
      { pitch: "C5", duration: "2n." },
    ];
    const g = notesToGrid(notes, 2, "3/4")!;
    expect(g.totalSteps).toBe(24);
    expect(g.stepsPerBar).toBe(12);
    expect(gridToNotes(g)).toEqual(notes);
    const chords: Chord[] = [{ chord: "C", bar: 1, beat: 1 }, { chord: "F", bar: 1, beat: 3 }, { chord: "C", bar: 2, beat: 1 }];
    const abc = expectDisplayMatchesSound(notes, { key: "C", timeSignature: "3/4", bars: 2, chords });
    expect(abc).toContain("M:3/4");
  });
});

describe("gridToNotes", () => {
  const grid = (notes: Grid["notes"], bars = 1): Grid => ({ notes, totalSteps: bars * 16, stepsPerBar: 16 });

  it("fills an empty bar with a whole rest", () => {
    expect(gridToNotes(grid([]))).toEqual([{ pitch: "rest", duration: "1n" }]);
  });

  it("truncates unrepresentable lengths and never crosses bar lines or splitAt steps", () => {
    const notes = gridToNotes(grid([{ step: 0, length: 5, pitch: "C4" }, { step: 12, length: 8, pitch: "D4" }], 2), { splitAt: [20] });
    expect(notes).toEqual([
      { pitch: "C4", duration: "4n" }, // 5 -> 4
      { pitch: "rest", duration: "4n" }, // the truncated 16th + beat 2
      { pitch: "rest", duration: "4n" },
      { pitch: "D4", duration: "4n" }, // stops at the bar line
      { pitch: "rest", duration: "4n" }, // up to splitAt 20
      { pitch: "rest", duration: "4n" },
      { pitch: "rest", duration: "2n" },
    ]);
  });

  it("chunks rests on beat boundaries", () => {
    const notes = gridToNotes(grid([{ step: 1, length: 1, pitch: "C4" }]));
    expect(notes.map((n) => n.duration)).toEqual(["16n", "16n", "8n", "4n", "2n"]);
  });
});

describe("toggleStep", () => {
  const base: Grid = { notes: [{ step: 0, length: 8, pitch: "Eb4", velocity: 0.8 }], totalSteps: 16, stepsPerBar: 16 };

  it("removes a note when toggling its onset", () => {
    expect(toggleStep(base, 0, "C4")).toEqual({ grid: { ...base, notes: [] }, armed: null });
  });

  it("splits a sustaining note, keeping its pitch", () => {
    const { grid, armed } = toggleStep(base, 3, "C4");
    expect(armed).toBe(3);
    expect(grid.notes).toEqual([
      { step: 0, length: 3, pitch: "Eb4", velocity: 0.8 },
      { step: 3, length: 5, pitch: "Eb4", velocity: 0.8 },
    ]);
    // 5 steps isn't representable: gridToNotes (and normalizeGrid) truncate to a quarter + rest.
    expect(normalizeGrid(grid).notes.map((n) => [n.step, n.length])).toEqual([[0, 3], [3, 4]]);
  });

  it("adds a note in silence, at most 2 steps and bounded by the next onset / bar line", () => {
    const g: Grid = { notes: [{ step: 11, length: 1, pitch: "G4" }], totalSteps: 32, stepsPerBar: 16 };
    expect(toggleStep(g, 8, "C4")).toEqual({
      grid: { ...g, notes: [{ step: 8, length: 2, pitch: "C4" }, g.notes[0]] },
      armed: 8,
    });
    expect(toggleStep(g, 10, "C4").grid.notes[0]).toEqual({ step: 10, length: 1, pitch: "C4" });
    expect(toggleStep(g, 15, "C4").grid.notes[1]).toEqual({ step: 15, length: 1, pitch: "C4" });
  });

  it("ignores out-of-range steps", () => {
    expect(toggleStep(base, 16, "C4")).toEqual({ grid: base, armed: null });
  });
});

describe("noteAtStep / setStepPitch", () => {
  const g: Grid = { notes: [{ step: 4, length: 4, pitch: "C4" }], totalSteps: 16, stepsPerBar: 16 };
  it("finds covering notes", () => {
    expect(noteAtStep(g, 4)).toEqual({ note: g.notes[0], index: 0, isOnset: true });
    expect(noteAtStep(g, 7)?.isOnset).toBe(false);
    expect(noteAtStep(g, 8)).toBeNull();
  });
  it("sets pitch only on onsets", () => {
    expect(setStepPitch(g, 4, "D4").notes[0].pitch).toBe("D4");
    expect(setStepPitch(g, 5, "D4")).toBe(g);
    expect(setStepPitch(g, 4, "nope")).toBe(g);
  });
});

describe("transposeStep", () => {
  const g: Grid = { notes: [{ step: 0, length: 4, pitch: "Bb4" }, { step: 4, length: 4, pitch: "C#4" }], totalSteps: 16, stepsPerBar: 16 };
  it("transposes, keeping the original accidental family", () => {
    expect(transposeStep(g, 0, 1).notes[0].pitch).toBe("B4");
    expect(transposeStep(g, 0, -1).notes[0].pitch).toBe("A4");
    expect(transposeStep(g, 0, 3).notes[0].pitch).toBe("Db5");
    expect(transposeStep(g, 4, 2).notes[1].pitch).toBe("D#4");
    expect(transposeStep(g, 5, 2, undefined, "flats").notes[1].pitch).toBe("Eb4"); // sustain step works too
  });
  it("clamps to the range (default MIDI 48..84)", () => {
    expect(transposeStep(g, 0, 48).notes[0].pitch).toBe("C6");
    expect(transposeStep(g, 4, -48).notes[1].pitch).toBe("C3");
    expect(transposeStep(g, 0, 12, [60, 72]).notes[0].pitch).toBe("C5");
    expect(transposeStep(g, 8, 1)).toBe(g); // silence: no-op
  });
});

describe("notesToAbc", () => {
  const meta = (key: string, bars = 1, chords: Chord[] = []) => ({ key, timeSignature: "4/4", bars, chords });
  const q = (pitch: string): Note => ({ pitch, duration: "4n" });
  const body = (abc: string) => abc.split("\n").slice(4).join("\n");

  it("writes the header and octaves", () => {
    const abc = notesToAbc([q("B3"), q("C4"), q("C5"), q("C6")], { ...meta("C"), title: "Hi" });
    expect(abc).toBe("X:1\nT:Hi\nM:4/4\nL:1/16\nK:C\nB,4 C4 c4 c'4|]");
  });

  it("K:F with B natural then B flat in the same bar", () => {
    const notes = [q("B4"), q("Bb4"), q("B4"), q("Bb4")];
    expect(body(notesToAbc(notes, meta("F")))).toBe("=B4 _B4 =B4 _B4|]");
    expectDisplayMatchesSound(notes, meta("F"));
  });

  it("K:C with F# then F natural, and carry within the bar", () => {
    const notes = [q("F#4"), q("F#4"), q("F4"), q("F5")];
    expect(body(notesToAbc(notes, meta("C")))).toBe("^F4 F4 =F4 f4|]");
    expectDisplayMatchesSound(notes, meta("C"));
  });

  it("resets accidentals at the bar line", () => {
    const notes = [q("F#4"), { pitch: "rest", duration: "2n." }, q("F#4"), { pitch: "F4", duration: "2n." }];
    expect(body(notesToAbc(notes, meta("C", 2)))).toBe("^F4 z12| ^F4 =F12|]");
    expectDisplayMatchesSound(notes, meta("C", 2));
  });

  it("keeps the pitch string's spelling and respects the key signature", () => {
    expect(body(notesToAbc([q("Eb4"), q("D#4"), q("Eb4"), q("E4")], meta("Bb")))).toBe("E4 ^D4 E4 =E4|]");
    expect(body(notesToAbc([q("Cb4"), q("B#3"), q("F##4"), q("Ebb4")], meta("C")))).toBe("_C4 ^B,4 ^^F4 __E4|]");
    expectDisplayMatchesSound([q("Cb4"), q("B#3"), q("F##4"), q("Ebb4")], meta("C"));
  });

  it("beams per beat and places chords", () => {
    const notes: Note[] = [
      ...["C4", "D4", "E4", "F4"].map((pitch) => ({ pitch, duration: "16n" })),
      { pitch: "G4", duration: "8n" }, { pitch: "A4", duration: "8n" },
      { pitch: "rest", duration: "2n" },
    ];
    const chords = [{ chord: "C", bar: 1, beat: 1 }, { chord: "F7", bar: 1, beat: 2 }, { chord: "G7", bar: 1, beat: 4 }];
    // G7 at beat 4 has no element starting there: it attaches to the covering half rest.
    expect(body(notesToAbc(notes, meta("C", 1, chords)))).toBe('"C"CDEF "F7"G2A2 "G7"z8|]');
  });

  it("breaks lines every 4 bars on 8-bar forms", () => {
    const abc = notesToAbc(Array.from({ length: 8 }, () => ({ pitch: "C4", duration: "1n" })), meta("C", 8));
    expect(body(abc)).toBe("C16| C16| C16| C16|\nC16| C16| C16| C16|]");
  });

  it("matches abcjs key signatures", () => {
    const keys = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
      "Am", "Em", "Dm", "Gm", "Cm", "Fm", "Bbm", "F#m", "C#m", "Ebm", "D Dor", "G Mix", "E Phr", "F Lyd", "B Loc", "Amin", "Cmaj"];
    const ACC: Record<string, number> = { sharp: 1, flat: -1 };
    for (const key of keys) {
      const tune = abcjs.parseOnly(`X:1\nK:${key}\nC|`)[0];
      const fromAbcjs: Record<string, number> = {};
      for (const a of tune.getKeySignature().accidentals ?? []) fromAbcjs[a.note.toUpperCase()] = ACC[a.acc];
      expect(keySignatureAccidentals(key), key).toEqual(fromAbcjs);
    }
  });
});

// Seeded PRNG (mulberry32) so failures reproduce.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PITCH_POOL = ["C4", "C#4", "Db4", "D4", "Eb4", "E4", "F4", "F#4", "Gb4", "G4", "Ab4", "A4", "Bb4", "B4", "C5", "A#3", "E5", "G#5"];

describe("property: display == sound after random edits", () => {
  const variants: Lick[] = [
    ...LICKS,
    { ...LICKS[0], id: "three-four", timeSignature: "3/4", bars: 4, notes: [], chords: [{ chord: "C", bar: 1, beat: 1 }, { chord: "G7", bar: 3, beat: 2 }] },
  ];
  variants.forEach((lick, li) => {
    it(`${lick.id}: 300 random edits`, () => {
      const rand = rng(1234 + li);
      const splitAt = chordSplitSteps(lick.chords, lick.timeSignature);
      let grid = notesToGrid(lick.notes, lick.bars, lick.timeSignature)!;
      expect(grid).not.toBeNull();
      for (let i = 0; i < 300; i++) {
        const step = Math.floor(rand() * grid.totalSteps);
        const op = rand();
        if (op < 0.5) grid = toggleStep(grid, step, PITCH_POOL[Math.floor(rand() * PITCH_POOL.length)]).grid;
        else if (op < 0.7) grid = setStepPitch(grid, step, PITCH_POOL[Math.floor(rand() * PITCH_POOL.length)]);
        else grid = transposeStep(grid, step, Math.floor(rand() * 25) - 12, undefined, rand() < 0.5 ? "sharps" : "flats");
        if (rand() < 0.3) grid = normalizeGrid(grid, { splitAt });

        const notes = gridToNotes(grid, { splitAt });
        expectDisplayMatchesSound(notes, lick);
        // What's heard maps back onto the grid, and re-exporting is stable.
        const back = notesToGrid(notes, lick.bars, lick.timeSignature)!;
        expect(gridToNotes(back, { splitAt })).toEqual(notes);
        expect(normalizeGrid(grid, { splitAt })).toEqual(back);
      }
    });
  });
});

describe("editing leaves untouched notes alone", () => {
  it("a note held across a chord change survives an edit elsewhere (no splitAt)", () => {
    const notes: Note[] = [
      { pitch: "D4", duration: "8n" }, { pitch: "F4", duration: "8n" }, { pitch: "A4", duration: "8n" },
      { pitch: "B4", duration: "4n" }, // steps 6-9: held across G7 at step 8
      { pitch: "D5", duration: "8n" }, { pitch: "rest", duration: "4n" },
      { pitch: "C5", duration: "1n" },
    ];
    const grid = notesToGrid(notes, 2, "4/4")!;
    const edited = toggleStep(grid, 20, "E4").grid;
    const b4 = notesToGrid(gridToNotes(edited), 2, "4/4")!.notes.find(n => n.pitch === "B4");
    expect(b4).toMatchObject({ step: 6, length: 4 });
  });
});
