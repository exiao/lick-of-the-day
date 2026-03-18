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
  swing: 0.25,
  feel: "laid-back, slightly behind the beat",
  chords: [
    { chord: "Ebmaj7", bar: 1, beat: 1 },
    { chord: "Cm7", bar: 2, beat: 1 },
    { chord: "Abmaj7", bar: 3, beat: 1 },
    { chord: "Bb7", bar: 4, beat: 1 },
  ],
  abc: `X:1\nM:4/4\nL:1/8\nK:Eb\n|:"Ebmaj7" E2G2 B2d2|"Cm7" c2_B2 G2E2|"Abmaj7" _A,2C2 E2G2|"Bb7" F2D2 E4:|`,
  notes: [
    // Bar 1: Ebmaj7 - ascending arpeggio, accent on root
    { pitch: "Eb4", duration: "4n", time: 0.0,   velocity: 0.85, articulation: "accent" },
    { pitch: "G4",  duration: "4n", time: 0.632, velocity: 0.65, articulation: "legato" },
    { pitch: "Bb4", duration: "4n", time: 1.263, velocity: 0.7,  articulation: "normal" },
    { pitch: "D5",  duration: "4n", time: 1.895, velocity: 0.8,  articulation: "accent" },
    // Bar 2: Cm7 - descending
    { pitch: "C5",  duration: "4n", time: 2.526, velocity: 0.85, articulation: "accent" },
    { pitch: "Bb4", duration: "4n", time: 3.158, velocity: 0.6,  articulation: "legato" },
    { pitch: "G4",  duration: "4n", time: 3.789, velocity: 0.4,  articulation: "ghost"  },
    { pitch: "Eb4", duration: "4n", time: 4.421, velocity: 0.75, articulation: "normal" },
    // Bar 3: Abmaj7 - rising from root
    { pitch: "Ab3", duration: "4n", time: 5.053, velocity: 0.85, articulation: "accent" },
    { pitch: "C4",  duration: "4n", time: 5.684, velocity: 0.65, articulation: "legato" },
    { pitch: "Eb4", duration: "4n", time: 6.316, velocity: 0.7,  articulation: "normal" },
    { pitch: "G4",  duration: "4n", time: 6.947, velocity: 0.75, articulation: "normal" },
    // Bar 4: Bb7 - resolve to Eb
    { pitch: "F4",  duration: "4n", time: 7.579, velocity: 0.8,  articulation: "accent" },
    { pitch: "D4",  duration: "4n", time: 8.211, velocity: 0.35, articulation: "ghost"  },
    { pitch: "Eb4", duration: "2n", time: 8.842, velocity: 0.9,  articulation: "accent" },
  ],
};
