import type { Lick } from "../types/lick";

// Tempo 95 BPM: quarter = 0.632s, eighth = 0.316s, bar = 2.526s
export const FALLBACK_LICK: Lick = {
  id: "2026-03-17",
  genre: "rnb",
  title: "Neo-Soul Bounce in Eb",
  bars: 4,
  tempo: 95,
  timeSignature: "4/4",
  key: "Eb",
  chords: [
    { chord: "Ebmaj7", bar: 1, beat: 1 },
    { chord: "Cm7", bar: 2, beat: 1 },
    { chord: "Abmaj7", bar: 3, beat: 1 },
    { chord: "Bb7", bar: 4, beat: 1 },
  ],
  abc: `X:1
M:4/4
L:1/8
K:Eb
|:"Ebmaj7" E2G2 B2d2|"Cm7" c2_B2 G2E2|"Abmaj7" _A,2C2 E2G2|"Bb7" F2D2 E4:|`,
  notes: [
    // Bar 1 (0s): Ebmaj7 - ascending arpeggio
    { pitch: "Eb4", duration: "4n", time: 0.0 },
    { pitch: "G4", duration: "4n", time: 0.632 },
    { pitch: "Bb4", duration: "4n", time: 1.263 },
    { pitch: "D5", duration: "4n", time: 1.895 },
    // Bar 2 (2.526s): Cm7 - descending
    { pitch: "C5", duration: "4n", time: 2.526 },
    { pitch: "Bb4", duration: "4n", time: 3.158 },
    { pitch: "G4", duration: "4n", time: 3.789 },
    { pitch: "Eb4", duration: "4n", time: 4.421 },
    // Bar 3 (5.053s): Abmaj7 - rising from the root
    { pitch: "Ab3", duration: "4n", time: 5.053 },
    { pitch: "C4", duration: "4n", time: 5.684 },
    { pitch: "Eb4", duration: "4n", time: 6.316 },
    { pitch: "G4", duration: "4n", time: 6.947 },
    // Bar 4 (7.579s): Bb7 - resolve to Eb
    { pitch: "F4", duration: "4n", time: 7.579 },
    { pitch: "D4", duration: "4n", time: 8.211 },
    { pitch: "Eb4", duration: "2n", time: 8.842 },
  ],
};
