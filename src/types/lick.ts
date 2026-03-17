export interface Note {
  pitch: string;    // e.g. "C4", "Eb5"
  duration: string; // Tone.js format: "8n", "4n", "2n", etc.
  time: number;     // seconds from start at the given tempo
}

export interface Chord {
  chord: string; // e.g. "Cm7", "F7"
  bar: number;
  beat: number;
}

export type Genre = "jazz" | "blues" | "funk" | "rnb" | "bossa";

export interface Lick {
  id: string;
  genre: Genre;
  title: string;
  bars: number;
  tempo: number;
  timeSignature: string;
  key: string;
  chords: Chord[];
  abc: string;
  notes: Note[];
}

export const GENRES: { value: Genre; label: string }[] = [
  { value: "jazz", label: "Jazz" },
  { value: "rnb", label: "R&B" },
  { value: "funk", label: "Funk" },
  { value: "blues", label: "Blues" },
  { value: "bossa", label: "Bossa Nova" },
];

export const BAR_OPTIONS = [2, 4, 6, 8] as const;
