import { describe, it, expect } from "vitest";
import { extractClosedFields } from "./partial-json";
import { FALLBACK_LICK } from "../../functions/_shared/fallback";

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
    }
    expect(extractClosedFields(full)).toEqual({ title: FALLBACK_LICK.title, abc: FALLBACK_LICK.abc });
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

  it("braces/brackets inside a string value don't break later fields", () => {
    const obj = { title: "weird } title ] value", abc: "X:1\nK:C\nC4|", notes: [{ pitch: "C4", duration: "4n" }] };
    const got = extractClosedFields(JSON.stringify(obj));
    expect(got.title).toBe("weird } title ] value");
    expect(got.abc).toBe("X:1\nK:C\nC4|");
  });

  it("a key-shaped substring inside a string value is not mistaken for a field", () => {
    // The title literally contains `"abc": "BAD"`; the real abc is "GOOD".
    const obj = { title: 'fake "abc": "BAD"', abc: "GOOD", notes: [{ pitch: "C4", duration: "4n" }] };
    const got = extractClosedFields(JSON.stringify(obj));
    expect(got.title).toBe('fake "abc": "BAD"');
    expect(got.abc).toBe("GOOD"); // not "BAD"
  });

  it("does not surface a nested-object key as a top-level field", () => {
    // A nested ABC string must not become the preview score.
    const buf = '{"title":"T","meta":{"abc":"BAD"},"abc":"X:1\\nK:C\\nC4|"}';
    const got = extractClosedFields(buf);
    expect(got.abc).toBe("X:1\nK:C\nC4|");
  });

  it("returns empty object for buffers with no closed fields", () => {
    expect(extractClosedFields('{"genre": "ja')).toEqual({});
    expect(extractClosedFields("")).toEqual({});
  });
});
