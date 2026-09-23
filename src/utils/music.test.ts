import { describe, expect, it } from "vitest";
import { parsePitch } from "./music";

describe("parsePitch", () => {
  it("reads enharmonic spellings that cross the octave line", () => {
    expect(parsePitch("Cb4").midi).toBe(parsePitch("B3").midi);
    expect(parsePitch("B#3").midi).toBe(parsePitch("C4").midi);
    expect(parsePitch("Bb3").midi).toBe(58);
    expect(parsePitch("C4").midi).toBe(60);
  });
});
