import type { Lick } from "../types/lick";

export const FALLBACK_LICK: Lick = {
  id: "2026-03-17",
  genre: "jazz",
  title: "Minor ii-V-I in Bb",
  bars: 4,
  tempo: 120,
  timeSignature: "4/4",
  key: "Bb",
  chords: [
    { chord: "Cm7", bar: 1, beat: 1 },
    { chord: "F7", bar: 2, beat: 1 },
    { chord: "Bbmaj7", bar: 3, beat: 1 },
    { chord: "Bbmaj7", bar: 4, beat: 1 },
  ],
  abc: `X:1
M:4/4
L:1/8
K:Bb
|:"Cm7" CDEF GABc|"F7" d2c2 A2F2|"Bbmaj7" G2F2 D2C2|"Bbmaj7" B,4 z4:|`,
  notes: [
    // Bar 1: Cm7 - ascending scale run
    { pitch: "C4", duration: "8n", time: 0.0 },
    { pitch: "D4", duration: "8n", time: 0.25 },
    { pitch: "Eb4", duration: "8n", time: 0.5 },
    { pitch: "F4", duration: "8n", time: 0.75 },
    { pitch: "G4", duration: "8n", time: 1.0 },
    { pitch: "A4", duration: "8n", time: 1.25 },
    { pitch: "Bb4", duration: "8n", time: 1.5 },
    { pitch: "C5", duration: "8n", time: 1.75 },
    // Bar 2: F7 - descending
    { pitch: "D5", duration: "4n", time: 2.0 },
    { pitch: "C5", duration: "4n", time: 2.5 },
    { pitch: "A4", duration: "4n", time: 3.0 },
    { pitch: "F4", duration: "4n", time: 3.5 },
    // Bar 3: Bbmaj7 - resolution
    { pitch: "G4", duration: "4n", time: 4.0 },
    { pitch: "F4", duration: "4n", time: 4.5 },
    { pitch: "D4", duration: "4n", time: 5.0 },
    { pitch: "C4", duration: "4n", time: 5.5 },
    // Bar 4: Bbmaj7 - landing
    { pitch: "Bb3", duration: "2n", time: 6.0 },
  ],
};
