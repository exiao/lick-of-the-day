import { describe, it, expect } from "vitest";
import { extractClosedFields } from "./partial-json";
import { FALLBACK_LICK } from "./mock-lick";

// Build the JSON string the model emits, in the schema's field order.
function serializeInModelOrder(l: typeof FALLBACK_LICK): string {
  const ordered = {
    genre: l.genre, title: l.title, bars: l.bars, tempo: l.tempo,
    timeSignature: l.timeSignature, key: l.key, swing: l.swing, feel: l.feel,
    chords: l.chords, abc: l.abc, notes: l.notes,
  };
  return JSON.stringify(ordered, null, 2);
}

describe("extractClosedFields — truncation sweep", () => {
  const full = serializeInModelOrder(FALLBACK_LICK);

  it("never surfaces a corrupt or partial field at any prefix length", () => {
    for (let n = 1; n <= full.length; n++) {
      const got = extractClosedFields(full.slice(0, n));
      if (got.title !== undefined) expect(got.title).toBe(FALLBACK_LICK.title);
      if (got.abc !== undefined) expect(got.abc).toBe(FALLBACK_LICK.abc);
      if (got.notes !== undefined) {
        expect(got.notes.length).toBeLessThanOrEqual(FALLBACK_LICK.notes.length);
        for (const el of got.notes) {
          expect(typeof el).toBe("object");
          expect(el).toHaveProperty("pitch");
          expect(el).toHaveProperty("duration");
        }
      }
    }
  });

  it("notes count grows monotonically to the full count", () => {
    let prev = 0;
    let max = 0;
    for (let n = 1; n <= full.length; n++) {
      const got = extractClosedFields(full.slice(0, n));
      if (got.notes) {
        expect(got.notes.length).toBeGreaterThanOrEqual(prev);
        prev = got.notes.length;
        max = Math.max(max, prev);
      }
    }
    expect(max).toBe(FALLBACK_LICK.notes.length);
  });

  it("abc becomes available before the stream ends (early sheet paint)", () => {
    let firstSeen = -1;
    for (let n = 1; n <= full.length; n++) {
      if (extractClosedFields(full.slice(0, n)).abc !== undefined) { firstSeen = n; break; }
    }
    expect(firstSeen).toBeGreaterThan(0);
    expect(firstSeen).toBeLessThan(full.length);
    // sanity: the abc lands in the first ~40% of the payload (notes dominate the tail)
    expect(firstSeen / full.length).toBeLessThan(0.4);
  });

  it("final buffer parses as valid JSON", () => {
    expect(() => JSON.parse(full)).not.toThrow();
  });
});

describe("extractClosedFields — adversarial", () => {
  it("abc containing escaped chord quotes round-trips exactly", () => {
    const trickyAbc = 'X:1\nM:4/4\nK:C\n"Dm7"A2 z F D2|"G7"G4|';
    const full = JSON.stringify({ title: "T", abc: trickyAbc, notes: [{ pitch: "C4", duration: "4n" }] });
    let seen: string | undefined;
    for (let n = 1; n <= full.length; n++) {
      const g = extractClosedFields(full.slice(0, n));
      if (g.abc !== undefined) { seen = g.abc; expect(g.abc).toBe(trickyAbc); }
    }
    expect(seen).toBe(trickyAbc);
  });

  it("token-sized chunked arrival stays correct and monotonic", () => {
    const realAbc = 'X:1\nM:4/4\nK:C\n"Dm7"DEFA|"G7"G4|';
    const obj = {
      genre: "jazz", title: "Chunk Test", bars: 4, tempo: 120,
      timeSignature: "4/4", key: "C", swing: 0.3, feel: "swing",
      chords: [{ chord: "Dm7", bar: 1, beat: 1 }, { chord: "G7", bar: 2, beat: 1 }],
      abc: realAbc,
      notes: Array.from({ length: 12 }, (_, i) => ({ pitch: "C4", duration: "8n", idx: i })),
    };
    const big = JSON.stringify(obj);
    let buf = "";
    let i = 0;
    let prev = 0;
    let abcAt = -1;
    // Deterministic pseudo-random chunk sizes for reproducibility.
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    while (i < big.length) {
      const step = 3 + Math.floor(rnd() * 9);
      buf += big.slice(i, i + step);
      i += step;
      const g = extractClosedFields(buf);
      if (g.abc !== undefined) { expect(g.abc).toBe(realAbc); if (abcAt === -1) abcAt = buf.length; }
      if (g.notes) { expect(g.notes.length).toBeGreaterThanOrEqual(prev); prev = g.notes.length; }
    }
    expect(prev).toBe(12);
    expect(abcAt).toBeGreaterThan(0);
    expect(abcAt).toBeLessThan(big.length);
  });

  it("braces/brackets inside a string value don't break later fields", () => {
    const obj = { title: "weird } title ] value", abc: "X:1\nK:C\nC4|", notes: [{ pitch: "C4", duration: "4n" }] };
    const got = extractClosedFields(JSON.stringify(obj));
    expect(got.title).toBe("weird } title ] value");
    expect(got.abc).toBe("X:1\nK:C\nC4|");
    expect(Array.isArray(got.notes) && got.notes.length).toBe(1);
  });

  it("returns empty object for buffers with no closed fields", () => {
    expect(extractClosedFields('{"genre": "ja')).toEqual({});
    expect(extractClosedFields("")).toEqual({});
  });
});
