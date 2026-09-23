import type { Lick } from "../types/lick";

// Hand-written, original jazz licks (and one short tune) that form a practice pathway.
// Each is 4/4, L:1/8, no pickup, no ties, and the ABC mirrors the notes array one-for-one
// (rests included) so the sheet highlight, piano and playback stay aligned.
// curated-licks.test.ts enforces that alignment.

export interface CuratedLick {
  level: number;
  /** "lick" = a 4-bar vocabulary phrase; "tune" = a complete short head with its own form. */
  kind: "lick" | "tune";
  /** One-line practice focus shown on the pathway card. */
  focus: string;
  /** Slow tempo to start practicing at. */
  practiceTempo: number;
  lick: Lick;
}

export const CURATED_LICKS: CuratedLick[] = [
  {
    level: 1,
    kind: "lick",
    focus: "Enclose the 3rd: Bb and G# squeeze into A as F major arrives.",
    practiceTempo: 90,
    lick: {
      id: "studio-01-chromatic-doorway",
      genre: "jazz",
      title: "Chromatic Doorway",
      bars: 4,
      tempo: 132,
      timeSignature: "4/4",
      key: "F",
      swing: 0.55,
      feel: "medium swing",
      chords: [
        { chord: "Gm7", bar: 1, beat: 1 },
        { chord: "C7", bar: 2, beat: 1 },
        { chord: "Fmaj7", bar: 3, beat: 1 },
        { chord: "Fmaj7", bar: 4, beat: 1 },
      ],
      abc: `X:1\nM:4/4\nL:1/8\nK:F\n"Gm7" zD FA B2 A_A|"C7" G2 zE Gc B^G|"Fmaj7" A3 c e2 dc|"Fmaj7" A4 z4|]`,
      notes: [
        // Bar 1 (Gm7): missed downbeat, arpeggio up to the 3rd, chromatic slip down
        { pitch: "rest", duration: "8n" },
        { pitch: "D4", duration: "8n", velocity: 0.55, articulation: "ghost" },
        { pitch: "F4", duration: "8n", velocity: 0.65, articulation: "legato" },
        { pitch: "A4", duration: "8n", velocity: 0.7, articulation: "legato" },
        { pitch: "Bb4", duration: "4n", velocity: 0.88, articulation: "accent" },
        { pitch: "A4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "Ab4", duration: "8n", velocity: 0.45, articulation: "ghost" },
        // Bar 2 (C7): land on the 5th, then Bb (b7) + G# enclose the next 3rd
        { pitch: "G4", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "E4", duration: "8n", velocity: 0.6, articulation: "normal" },
        { pitch: "G4", duration: "8n", velocity: 0.65, articulation: "legato" },
        { pitch: "C5", duration: "8n", velocity: 0.75, articulation: "legato" },
        { pitch: "Bb4", duration: "8n", velocity: 0.7, articulation: "normal" },
        { pitch: "G#4", duration: "8n", velocity: 0.45, articulation: "ghost" },
        // Bar 3 (Fmaj7): resolution to A (3rd), reach up to E (maj7)
        { pitch: "A4", duration: "4n.", velocity: 0.92, articulation: "accent" },
        { pitch: "C5", duration: "8n", velocity: 0.65, articulation: "legato" },
        { pitch: "E5", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "D5", duration: "8n", velocity: 0.55, articulation: "legato" },
        { pitch: "C5", duration: "8n", velocity: 0.6, articulation: "legato" },
        // Bar 4: settle on the 3rd and leave space
        { pitch: "A4", duration: "2n", velocity: 0.85, articulation: "legato" },
        { pitch: "rest", duration: "2n" },
      ],
    },
  },
  {
    level: 2,
    kind: "lick",
    focus: "Minor ii–V: one motif sequenced up a step; the b9 (Bb) over A7b9 falls to G.",
    practiceTempo: 84,
    lick: {
      id: "studio-02-minor-sequence",
      genre: "jazz",
      title: "Harmonic Minor Echo",
      bars: 4,
      tempo: 120,
      timeSignature: "4/4",
      key: "Dm",
      swing: 0.5,
      feel: "medium swing, minor",
      chords: [
        { chord: "Em7b5", bar: 1, beat: 1 },
        { chord: "A7b9", bar: 2, beat: 1 },
        { chord: "Dm6", bar: 3, beat: 1 },
        { chord: "Dm6", bar: 4, beat: 1 },
      ],
      abc: `X:1\nM:4/4\nL:1/8\nK:Dm\n"Em7b5" GB d2 z d cB|"A7b9" A^c e2 z B GE|"Dm6" F2 A=B d2 ^ce|"Dm6" d6 z2|]`,
      notes: [
        // Bar 1 (Em7b5): motif = two 8ths up, quarter, rest, stepwise fall
        { pitch: "G4", duration: "8n", velocity: 0.75, articulation: "accent" },
        { pitch: "Bb4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "D5", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "D5", duration: "8n", velocity: 0.6, articulation: "normal" },
        { pitch: "C5", duration: "8n", velocity: 0.5, articulation: "ghost" },
        { pitch: "Bb4", duration: "8n", velocity: 0.65, articulation: "legato" },
        // Bar 2 (A7b9): motif restated a step up; Bb (b9) falls through G to E
        { pitch: "A4", duration: "8n", velocity: 0.8, articulation: "accent" },
        { pitch: "C#5", duration: "8n", velocity: 0.65, articulation: "legato" },
        { pitch: "E5", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "Bb4", duration: "8n", velocity: 0.6, articulation: "normal" },
        { pitch: "G4", duration: "8n", velocity: 0.55, articulation: "legato" },
        { pitch: "E4", duration: "8n", velocity: 0.5, articulation: "ghost" },
        // Bar 3 (Dm6): E -> F (3rd), the natural 6th (B), C# + E enclose D
        { pitch: "F4", duration: "4n", velocity: 0.88, articulation: "accent" },
        { pitch: "A4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "B4", duration: "8n", velocity: 0.7, articulation: "legato" },
        { pitch: "D5", duration: "4n", velocity: 0.82, articulation: "accent" },
        { pitch: "C#5", duration: "8n", velocity: 0.5, articulation: "ghost" },
        { pitch: "E5", duration: "8n", velocity: 0.6, articulation: "normal" },
        // Bar 4: tonic arrival
        { pitch: "D5", duration: "2n.", velocity: 0.9, articulation: "legato" },
        { pitch: "rest", duration: "4n" },
      ],
    },
  },
  {
    level: 3,
    kind: "lick",
    focus: "Two chords per bar: land 3rds and 7ths on the changes, several by half-step. Loop it.",
    practiceTempo: 96,
    lick: {
      id: "studio-03-turnaround-guide-tones",
      genre: "jazz",
      title: "Guide-Tone Turnaround",
      bars: 4,
      tempo: 144,
      timeSignature: "4/4",
      key: "Bb",
      swing: 0.6,
      feel: "up-tempo swing, loopable turnaround",
      chords: [
        { chord: "Bbmaj7", bar: 1, beat: 1 },
        { chord: "G7", bar: 1, beat: 3 },
        { chord: "Cm7", bar: 2, beat: 1 },
        { chord: "F7", bar: 2, beat: 3 },
        { chord: "Dm7", bar: 3, beat: 1 },
        { chord: "G7", bar: 3, beat: 3 },
        { chord: "Cm7", bar: 4, beat: 1 },
        { chord: "F7", bar: 4, beat: 3 },
      ],
      abc: `X:1\nM:4/4\nL:1/8\nK:Bb\n"Bbmaj7" d2 zc "G7" =BG FD|"Cm7" E2 zG "F7" Ac e_d|"Dm7" c2 zA "G7" =Bd _A^F|"Cm7" G2 zB "F7" A4|]`,
      notes: [
        // Bar 1: D (3rd of Bb) ... C -> B (3rd of G7), fall to D -> Eb
        { pitch: "D5", duration: "4n", velocity: 0.88, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "C5", duration: "8n", velocity: 0.5, articulation: "ghost" },
        { pitch: "B4", duration: "8n", velocity: 0.8, articulation: "accent" },
        { pitch: "G4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "F4", duration: "8n", velocity: 0.62, articulation: "legato" },
        { pitch: "D4", duration: "8n", velocity: 0.5, articulation: "ghost" },
        // Bar 2: Eb (3rd of Cm7) ... up the F7 to Eb, chromatic slide to C
        { pitch: "Eb4", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "G4", duration: "8n", velocity: 0.55, articulation: "ghost" },
        { pitch: "A4", duration: "8n", velocity: 0.8, articulation: "accent" },
        { pitch: "C5", duration: "8n", velocity: 0.62, articulation: "legato" },
        { pitch: "Eb5", duration: "8n", velocity: 0.7, articulation: "normal" },
        { pitch: "Db5", duration: "8n", velocity: 0.48, articulation: "ghost" },
        // Bar 3: C (7th of Dm7) ... A -> B (3rd of G7), Ab + F# enclose G
        { pitch: "C5", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "A4", duration: "8n", velocity: 0.55, articulation: "ghost" },
        { pitch: "B4", duration: "8n", velocity: 0.8, articulation: "accent" },
        { pitch: "D5", duration: "8n", velocity: 0.62, articulation: "legato" },
        { pitch: "Ab4", duration: "8n", velocity: 0.6, articulation: "normal" },
        { pitch: "F#4", duration: "8n", velocity: 0.45, articulation: "ghost" },
        // Bar 4: G (5th of Cm7) ... Bb -> A (3rd of F7), loops back to D
        { pitch: "G4", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "Bb4", duration: "8n", velocity: 0.55, articulation: "ghost" },
        { pitch: "A4", duration: "2n", velocity: 0.88, articulation: "legato" },
      ],
    },
  },
  {
    level: 4,
    kind: "tune",
    focus: "An 8-bar head in A/A′ form. Rest on beat 1, rise, hold the long note; bar 5 repeats the hook a step up. Hear the altered dominants resolve into Dm7 and C6.",
    practiceTempo: 80,
    lick: {
      id: "studio-04-night-bus-home",
      genre: "jazz",
      title: "Night Bus Home",
      bars: 8,
      tempo: 126,
      timeSignature: "4/4",
      key: "C",
      swing: 0.55,
      feel: "medium swing, 8-bar head",
      chords: [
        { chord: "Cmaj7", bar: 1, beat: 1 },
        { chord: "A7b9", bar: 2, beat: 1 },
        { chord: "Dm7", bar: 3, beat: 1 },
        { chord: "G7", bar: 4, beat: 1 },
        { chord: "Em7", bar: 5, beat: 1 },
        { chord: "A7b9", bar: 6, beat: 1 },
        { chord: "Dm7", bar: 7, beat: 1 },
        { chord: "G7", bar: 7, beat: 3 },
        { chord: "C6", bar: 8, beat: 1 },
      ],
      // Line break after bar 4 so each phrase (A, then A′) sits on its own system.
      abc: `X:1\nM:4/4\nL:1/8\nK:C\n"Cmaj7" zE G B3 zG|"A7b9" z^C E _B3 zG|"Dm7" F2 Ac e2 dc|"G7" B2 A_A G2 z2|\n"Em7" zG B d3 zB|"A7b9" z^c _BG E2 zE|"Dm7" FA cA "G7" Bd _AF|"C6" E2 zG A4|]`,
      notes: [
        // A section
        // Bar 1 (Cmaj7): the hook, a silent downbeat, three 8ths up, then hold the maj7 (B)
        { pitch: "rest", duration: "8n" },
        { pitch: "E4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "G4", duration: "8n", velocity: 0.68, articulation: "legato" },
        { pitch: "B4", duration: "4n.", velocity: 0.9, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "G4", duration: "8n", velocity: 0.5, articulation: "ghost" },
        // Bar 2 (A7b9): same rhythm; C#, E, then hold Bb (b9), the tension note
        { pitch: "rest", duration: "8n" },
        { pitch: "C#4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "E4", duration: "8n", velocity: 0.68, articulation: "legato" },
        { pitch: "Bb4", duration: "4n.", velocity: 0.9, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "G4", duration: "8n", velocity: 0.55, articulation: "normal" },
        // Bar 3 (Dm7): the answer; G (b7 of A7) falls to F, climb to the 9th (E)
        { pitch: "F4", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "A4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "C5", duration: "8n", velocity: 0.65, articulation: "legato" },
        { pitch: "E5", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "D5", duration: "8n", velocity: 0.55, articulation: "legato" },
        { pitch: "C5", duration: "8n", velocity: 0.6, articulation: "legato" },
        // Bar 4 (G7): C falls to B (3rd), chromatic A-Ab into the root, then breathe
        { pitch: "B4", duration: "4n", velocity: 0.85, articulation: "accent" },
        { pitch: "A4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "Ab4", duration: "8n", velocity: 0.5, articulation: "ghost" },
        { pitch: "G4", duration: "4n", velocity: 0.8, articulation: "normal" },
        { pitch: "rest", duration: "4n" },
        // A′ section
        // Bar 5 (Em7): the hook again, a step higher, holding D (b7)
        { pitch: "rest", duration: "8n" },
        { pitch: "G4", duration: "8n", velocity: 0.62, articulation: "legato" },
        { pitch: "B4", duration: "8n", velocity: 0.7, articulation: "legato" },
        { pitch: "D5", duration: "4n.", velocity: 0.92, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "B4", duration: "8n", velocity: 0.5, articulation: "ghost" },
        // Bar 6 (A7b9): the variation; the hook turns downward, C#, Bb (b9), G, E
        { pitch: "rest", duration: "8n" },
        { pitch: "C#5", duration: "8n", velocity: 0.75, articulation: "accent" },
        { pitch: "Bb4", duration: "8n", velocity: 0.65, articulation: "legato" },
        { pitch: "G4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "E4", duration: "4n", velocity: 0.8, articulation: "normal" },
        { pitch: "rest", duration: "8n" },
        { pitch: "E4", duration: "8n", velocity: 0.5, articulation: "ghost" },
        // Bar 7 (Dm7 | G7): running 8ths through ii-V; Ab (b9) and F (7th) set up the cadence
        { pitch: "F4", duration: "8n", velocity: 0.75, articulation: "accent" },
        { pitch: "A4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "C5", duration: "8n", velocity: 0.65, articulation: "legato" },
        { pitch: "A4", duration: "8n", velocity: 0.55, articulation: "legato" },
        { pitch: "B4", duration: "8n", velocity: 0.78, articulation: "accent" },
        { pitch: "D5", duration: "8n", velocity: 0.62, articulation: "legato" },
        { pitch: "Ab4", duration: "8n", velocity: 0.6, articulation: "normal" },
        { pitch: "F4", duration: "8n", velocity: 0.55, articulation: "legato" },
        // Bar 8 (C6): F resolves to E (3rd), the hook's rest, then rise to the 6th and hold
        { pitch: "E4", duration: "4n", velocity: 0.88, articulation: "accent" },
        { pitch: "rest", duration: "8n" },
        { pitch: "G4", duration: "8n", velocity: 0.6, articulation: "legato" },
        { pitch: "A4", duration: "2n", velocity: 0.85, articulation: "legato" },
      ],
    },
  },
];
