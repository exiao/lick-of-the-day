import { describe, it, expect } from "vitest";
import { SOUL_LICKS } from "./soul-licks";
import { checkLick, beatsOf } from "../test/lick-checks";
import type { Lick } from "../types/lick";

// Alignment checks are shared with the jazz pathway (src/test/lick-checks.ts); the rest
// pin down the R&B rhythm rules: a 16th grid, off-16th syncopation (or an & of 4
// anticipation), a call/response gap, and plenty of space overall.

const BEATS_PER_BAR = 4;
const ALLOWED = new Set(["16n", "8n", "8n.", "4n", "4n.", "2n", "2n.", "1n"]);
// At least ~1 beat of space per bar on average: R&B phrasing leaves room for the groove
// (and the vocal/band answer), and the curated jazz licks sit at 13-19% rests,
// so 25% keeps these noticeably airier without forcing sparse, lifeless lines.
const MIN_REST_SHARE = 0.25;

type Event = { pitch: string; onset: number; beats: number };

function events(lick: Lick): Event[] {
  let onset = 0;
  return lick.notes.map((n) => {
    const e = { pitch: n.pitch, onset, beats: beatsOf(n.duration) };
    onset += e.beats;
    return e;
  });
}

/** Contiguous rest spans (merging adjacent rests), in quarter beats. */
function restRuns(evts: Event[]): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  for (const e of evts) {
    if (e.pitch !== "rest") continue;
    const last = runs[runs.length - 1];
    if (last && last.end === e.onset) last.end = e.onset + e.beats;
    else runs.push({ start: e.onset, end: e.onset + e.beats });
  }
  return runs;
}

describe("soul licks", () => {
  for (const { level, lick } of SOUL_LICKS) {
    describe(`level ${level}: ${lick.id}`, () => {
      checkLick(lick, { rangeCheck: true, finalChordTone: true });

      const evts = events(lick);
      const total = lick.bars * BEATS_PER_BAR;

      it("uses only the supported durations, on a 16th-note grid", () => {
        expect(lick.notes.map((n) => n.duration).filter((d) => !ALLOWED.has(d))).toEqual([]);
        expect(evts.filter((e) => !Number.isInteger(e.onset * 4)).map((e) => e.onset)).toEqual([]);
      });

      it("has a 16th syncopation (onset on an e/a) or an & of 4 anticipation into a chord change", () => {
        const offSixteenth = evts.some((e) => e.pitch !== "rest" && (e.onset * 4) % 2 === 1);
        const changes = new Set(lick.chords.filter((c) => c.beat === 1).map((c) => (c.bar - 1) * BEATS_PER_BAR));
        const anticipation = evts.some(
          (e) => e.pitch !== "rest" && e.onset % BEATS_PER_BAR === 3.5 && changes.has(e.onset + 0.5),
        );
        expect(offSixteenth || anticipation).toBe(true);
      });

      it("leaves a gap of at least one beat mid-phrase for the response", () => {
        // "Mid-phrase" = not the opening breath or the closing tail: the gap starts after
        // the first two beats and ends before the last two.
        const mid = restRuns(evts).filter((r) => r.end - r.start >= 1 && r.start >= 2 && r.end <= total - 2);
        expect(mid.length).toBeGreaterThan(0);
      });

      it(`is at least ${MIN_REST_SHARE * 100}% rests`, () => {
        const rest = evts.filter((e) => e.pitch === "rest").reduce((s, e) => s + e.beats, 0);
        expect(rest / total).toBeGreaterThanOrEqual(MIN_REST_SHARE);
      });

      it("is an R&B lick with a sensible tempo, 16th swing and L:1/16 ABC", () => {
        expect(lick.genre).toBe("rnb");
        expect(lick.bars).toBe(4);
        expect(lick.timeSignature).toBe("4/4");
        expect(lick.tempo).toBeGreaterThanOrEqual(72);
        expect(lick.tempo).toBeLessThanOrEqual(100);
        expect(lick.swing).toBeGreaterThanOrEqual(0.1);
        expect(lick.swing).toBeLessThanOrEqual(0.25);
        expect(lick.abc).toContain("L:1/16");
      });
    });
  }

  it("levels run 1..n, all 4-bar licks, practice tempo below performance tempo", () => {
    expect(SOUL_LICKS.length).toBeGreaterThanOrEqual(3);
    expect(SOUL_LICKS.map((c) => c.level)).toEqual(SOUL_LICKS.map((_, i) => i + 1));
    for (const c of SOUL_LICKS) {
      expect(c.kind, c.lick.id).toBe("lick");
      expect(c.practiceTempo, c.lick.id).toBeLessThan(c.lick.tempo);
    }
    expect(new Set(SOUL_LICKS.map((c) => c.lick.id)).size).toBe(SOUL_LICKS.length);
  });
});
