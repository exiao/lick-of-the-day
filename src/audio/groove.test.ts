import { describe, expect, it } from "vitest";
import type { Chord } from "../types/lick";
import { chordRootPc } from "../utils/chords";
import {
  GROOVE_STYLES,
  buildBassLine,
  buildDrumPattern,
  defaultGrooveStyle,
  stepToTransportTime,
  type BassHit,
  type GrooveStyle,
} from "./groove";

const STYLES: GrooveStyle[] = ["pocket", "backbeat", "swing"];
const NAMES: Record<string, number> = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

function midi(pitch: string): number {
  const m = pitch.match(/^([A-G]b?)(-?\d)$/);
  if (!m) throw new Error(`unparseable pitch ${pitch}`);
  return (Number(m[2]) + 1) * 12 + NAMES[m[1]];
}

const iiVI: Chord[] = [
  { chord: "Dm7", bar: 1, beat: 1 },
  { chord: "G7", bar: 2, beat: 1 },
  { chord: "Cmaj7", bar: 3, beat: 1 },
  { chord: "A7", bar: 4, beat: 3 },
];
const busy: Chord[] = [
  { chord: "Ebmaj7", bar: 1, beat: 1 },
  { chord: "Abm7", bar: 1, beat: 3.5 }, // odd placement: the & of 3
  { chord: "Db7", bar: 2, beat: 2 },
  { chord: "Gbmaj7", bar: 2, beat: 4 },
  { chord: "B7", bar: 3, beat: 1 },
  { chord: "E", bar: 3, beat: 4 },
  { chord: "Fm7b5", bar: 4, beat: 1 },
  { chord: "Bb7sus4", bar: 4, beat: 2 },
];
const CASES: { chords: Chord[]; bars: number; bpb: number }[] = [
  { chords: iiVI, bars: 4, bpb: 4 },
  { chords: busy, bars: 4, bpb: 4 },
  { chords: [{ chord: "Fm9", bar: 1, beat: 1 }], bars: 2, bpb: 4 },
  { chords: [{ chord: "Fm9", bar: 1, beat: 1 }, { chord: "Bb13", bar: 2, beat: 1 }], bars: 2, bpb: 3 },
  { chords: [{ chord: "Gm7", bar: 1, beat: 1 }, { chord: "C7", bar: 1, beat: 3 }], bars: 1, bpb: 3 },
  { chords: iiVI, bars: 8, bpb: 4 },
];

function changeSteps(chords: Chord[], bpb: number): { step: number; chord: string }[] {
  return chords.map((c) => ({ step: Math.round(((c.bar - 1) * bpb + (c.beat - 1)) * 4), chord: c.chord }));
}

describe("stepToTransportTime", () => {
  it("converts absolute 16ths to bars:quarters:sixteenths", () => {
    expect(stepToTransportTime(0, 4)).toBe("0:0:0");
    expect(stepToTransportTime(7, 4)).toBe("0:1:3");
    expect(stepToTransportTime(16, 4)).toBe("1:0:0");
    expect(stepToTransportTime(30, 4)).toBe("1:3:2");
    expect(stepToTransportTime(12, 3)).toBe("1:0:0");
    expect(stepToTransportTime(23, 3)).toBe("1:2:3");
  });
});

describe("defaultGrooveStyle / GROOVE_STYLES", () => {
  it("maps genres to styles", () => {
    expect(defaultGrooveStyle("jazz")).toBe("swing");
    expect(defaultGrooveStyle("rnb")).toBe("pocket");
    expect(defaultGrooveStyle("funk")).toBe("pocket");
    expect(defaultGrooveStyle("blues")).toBe("backbeat");
    expect(defaultGrooveStyle("bossa")).toBe("backbeat");
  });
  it("lists every style once", () => {
    expect(GROOVE_STYLES.map((s) => s.value).sort()).toEqual([...STYLES].sort());
  });
});

describe("buildDrumPattern", () => {
  it.each(["pocket", "backbeat"] as const)("%s puts the snare backbeat on 2 & 4 of every 4/4 bar", (style) => {
    const hits = buildDrumPattern(style, 4, 4);
    for (let bar = 0; bar < 4; bar++) {
      for (const pos of [4, 12]) {
        const snare = hits.find((h) => h.step === bar * 16 + pos && h.voice === "snare");
        expect(snare, `bar ${bar} step ${pos}`).toBeDefined();
        expect(snare!.velocity).toBeGreaterThanOrEqual(0.9);
      }
      expect(hits.some((h) => h.step === bar * 16 && h.voice === "kick")).toBe(true);
    }
  });

  it("swing rides 1, 2, 2&, 3, 4, 4& with the hat foot on 2 & 4", () => {
    const hits = buildDrumPattern("swing", 2, 4);
    expect(hits.filter((h) => h.voice === "ride" && h.step < 16).map((h) => h.step)).toEqual([0, 4, 6, 8, 12, 14]);
    expect(hits.filter((h) => h.voice === "hat" && h.step < 16).map((h) => h.step)).toEqual([4, 12]);
    for (const k of hits.filter((h) => h.voice === "kick")) expect(k.velocity).toBeLessThanOrEqual(0.25);
  });

  it.each(STYLES)("%s keeps hits in range, unique per voice/step, with sane velocities", (style) => {
    for (const [bars, bpb] of [[1, 4], [2, 4], [4, 4], [8, 4], [2, 3], [4, 3], [2, 5]]) {
      const hits = buildDrumPattern(style, bars, bpb);
      expect(hits.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const h of hits) {
        expect(h.step).toBeGreaterThanOrEqual(0);
        expect(h.step).toBeLessThan(bars * bpb * 4);
        expect(h.velocity).toBeGreaterThan(0);
        expect(h.velocity).toBeLessThanOrEqual(1);
        const key = `${h.voice}@${h.step}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      for (let i = 1; i < hits.length; i++) expect(hits[i].step).toBeGreaterThanOrEqual(hits[i - 1].step);
    }
  });

  it("uses ghost velocities in the 0.2-0.35 range", () => {
    const ghosts = buildDrumPattern("pocket", 4, 4).filter((h) => h.voice === "ghost");
    expect(ghosts.length).toBeGreaterThan(0);
    for (const g of ghosts) {
      expect(g.velocity).toBeGreaterThanOrEqual(0.2);
      expect(g.velocity).toBeLessThanOrEqual(0.35);
    }
  });

  it("varies the last bar of a multi-bar loop (fill)", () => {
    const hits = buildDrumPattern("pocket", 4, 4);
    const bar = (i: number) => JSON.stringify(hits.filter((h) => Math.floor(h.step / 16) === i).map((h) => ({ ...h, step: h.step % 16 })));
    expect(bar(3)).not.toBe(bar(1));
    expect(bar(3)).not.toBe(bar(0));
  });

  it("works in 3/4", () => {
    const hits = buildDrumPattern("pocket", 2, 3);
    expect(Math.max(...hits.map((h) => h.step))).toBeLessThan(24);
    expect(hits.some((h) => h.step === 0 && h.voice === "kick")).toBe(true);
    expect(hits.some((h) => h.step === 8 && h.voice === "snare")).toBe(true);
  });

  it("differs per style and is deterministic", () => {
    const [a, b, c] = STYLES.map((s) => JSON.stringify(buildDrumPattern(s, 4, 4)));
    expect(new Set([a, b, c]).size).toBe(3);
    for (const s of STYLES) expect(buildDrumPattern(s, 4, 4)).toEqual(buildDrumPattern(s, 4, 4));
  });

  it("returns [] for empty lengths", () => {
    expect(buildDrumPattern("pocket", 0, 4)).toEqual([]);
  });
});

describe("buildBassLine", () => {
  it("returns [] with no chords", () => {
    for (const s of STYLES) expect(buildBassLine(s, [], 4, 4)).toEqual([]);
  });

  it.each(STYLES)("%s: every chord change gets a root hit on its step", (style) => {
    for (const { chords, bars, bpb } of CASES) {
      const hits = buildBassLine(style, chords, bars, bpb);
      for (const { step, chord } of changeSteps(chords, bpb)) {
        const hit = hits.find((h) => h.step === step);
        expect(hit, `${style} ${chord}@${step}`).toBeDefined();
        expect(midi(hit!.pitch) % 12).toBe(chordRootPc(chord));
        expect(hit!.role).toBe("root");
      }
    }
  });

  it.each(STYLES)("%s: no overlaps, in range, in register, parseable pitches", (style) => {
    for (const { chords, bars, bpb } of CASES) {
      const total = bars * bpb * 4;
      const hits = buildBassLine(style, chords, bars, bpb);
      hits.forEach((h, i) => {
        expect(h.step).toBeGreaterThanOrEqual(0);
        expect(h.step + h.lengthSteps).toBeLessThanOrEqual(total);
        expect(h.lengthSteps).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(h.step) && Number.isInteger(h.lengthSteps)).toBe(true);
        if (i + 1 < hits.length) expect(h.step + h.lengthSteps).toBeLessThanOrEqual(hits[i + 1].step);
        const m = midi(h.pitch);
        expect(m).toBeGreaterThanOrEqual(28);
        expect(m).toBeLessThanOrEqual(43);
        expect(h.pitch).not.toContain("#");
        expect(h.velocity).toBeGreaterThan(0);
        expect(h.velocity).toBeLessThanOrEqual(1);
      });
    }
  });

  it.each(STYLES)("%s: approach notes sit right before a change and resolve by <= 2 semitones", (style) => {
    for (const { chords, bars, bpb } of CASES) {
      const hits = buildBassLine(style, chords, bars, bpb);
      const approaches = hits.filter((h) => h.role === "approach");
      expect(approaches.length).toBeGreaterThan(0);
      for (const a of approaches) {
        const idx = hits.indexOf(a);
        // Target = next hit, or the first hit when wrapping at the loop point.
        const target = hits[idx + 1] ?? hits[0];
        expect(target.role).toBe("root");
        if (hits[idx + 1]) expect(a.step + a.lengthSteps).toBeLessThanOrEqual(target.step);
        else expect(a.step + a.lengthSteps).toBeLessThanOrEqual(bars * bpb * 4);
        const dist = Math.abs(midi(a.pitch) - midi(target.pitch));
        expect(dist).toBeGreaterThanOrEqual(1);
        expect(dist).toBeLessThanOrEqual(2);
      }
    }
  });

  it("uses distinct chord tones between changes and leaves rests", () => {
    const hits = buildBassLine("pocket", [{ chord: "Fm7", bar: 1, beat: 1 }], 2, 4);
    const pcs = new Set(hits.map((h) => midi(h.pitch) % 12));
    expect(pcs.has(5)).toBe(true); // F root
    expect(pcs.has(0)).toBe(true); // C fifth
    expect(pcs.has(3)).toBe(true); // Eb b7
    const sounding = hits.reduce((n, h) => n + h.lengthSteps, 0);
    expect(sounding).toBeLessThan(32 * 0.75);
  });

  it("uses a 6th on major triads and b7 on dominant chords", () => {
    const maj = buildBassLine("pocket", [{ chord: "C", bar: 1, beat: 1 }], 1, 4);
    expect(maj.find((h) => h.role === "seventh")?.pitch).toBe("A1");
    const dom = buildBassLine("pocket", [{ chord: "C7", bar: 1, beat: 1 }], 1, 4);
    expect(dom.find((h) => h.role === "seventh")?.pitch).toBe("Bb1");
  });

  it("lays out under chords without a root", () => {
    const hits = buildBassLine("backbeat", [{ chord: "N.C.", bar: 1, beat: 1 }, { chord: "G7", bar: 2, beat: 1 }], 2, 4);
    expect(hits.every((h) => h.step >= 16 || h.role === "approach")).toBe(true);
    expect(hits.find((h) => h.step === 16)?.pitch).toMatch(/^G/);
  });

  it("differs per style and is deterministic", () => {
    const lines = STYLES.map((s) => JSON.stringify(buildBassLine(s, iiVI, 4, 4)));
    expect(new Set(lines).size).toBe(3);
    for (const s of STYLES) expect(buildBassLine(s, busy, 4, 4)).toEqual(buildBassLine(s, busy, 4, 4));
  });

  it("works in 3/4", () => {
    const chords: Chord[] = [{ chord: "Dm7", bar: 1, beat: 1 }, { chord: "G7", bar: 2, beat: 1 }];
    const hits = buildBassLine("swing", chords, 2, 3);
    expect(hits[0]).toMatchObject({ step: 0, role: "root" });
    expect(hits.find((h) => h.step === 12)?.role).toBe("root");
    expect(hits.every((h) => h.step + h.lengthSteps <= 24)).toBe(true);
  });

  it("ignores chords past the end of the lick", () => {
    const hits = buildBassLine("pocket", [...iiVI, { chord: "E7", bar: 5, beat: 1 }], 4, 4);
    expect(hits.every((h) => h.step < 64)).toBe(true);
  });
});

// Keep the BassHit shape import used for type-checking the public API.
export type _BassHitShape = BassHit;
