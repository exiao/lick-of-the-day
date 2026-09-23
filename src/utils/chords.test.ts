import { describe, expect, it } from "vitest";
import { chordAtBeat, chordToneNames, compVoicing, degreeOver } from "./chords";

describe("chord theory helpers", () => {
  it("spells chord tones by scale degree", () => {
    expect(chordToneNames("C7")).toEqual(["C", "E", "G", "Bb"]);
    expect(chordToneNames("A7b9")).toEqual(["A", "C#", "E", "G"]);
    expect(chordToneNames("Em7b5")).toEqual(["E", "G", "Bb", "D"]);
    expect(chordToneNames("Dm6")).toEqual(["D", "F", "A", "B"]);
  });

  it("names a melody note's function over the chord", () => {
    expect(degreeOver("Fmaj7", 69)).toBe("3"); // A4
    expect(degreeOver("A7b9", 70)).toBe("b9"); // Bb4
    expect(degreeOver("Gm7", 70)).toBe("b3"); // Bb4
    expect(degreeOver("C7", 70)).toBe("b7"); // Bb4
  });

  it("voices a bass root under a 3rd/7th shell", () => {
    expect(compVoicing("G7")).toEqual({ bass: "G2", shell: ["F3", "B3"] });
    expect(compVoicing("Cm7")).toEqual({ bass: "C2", shell: ["Bb3", "Eb4"] });
  });

  it("finds the chord active at a beat, including beat-3 changes", () => {
    const chords = [{ chord: "Bbmaj7", bar: 1, beat: 1 }, { chord: "G7", bar: 1, beat: 3 }, { chord: "Cm7", bar: 2, beat: 1 }];
    expect(chordAtBeat(chords, 1.5, 4)?.chord.chord).toBe("Bbmaj7");
    expect(chordAtBeat(chords, 2, 4)?.chord.chord).toBe("G7");
    expect(chordAtBeat(chords, 4, 4)?.chord.chord).toBe("Cm7");
  });
});
