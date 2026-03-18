export type Articulation = "normal" | "staccato" | "legato" | "accent" | "ghost";

export interface Note {
  pitch: string;          // e.g. "C4", "Eb5"
  duration: string;       // Tone.js format: "8n", "4n", "2n", etc.
  time?: number;          // DEPRECATED — computed from duration sequence at playback
  // Articulation (optional, defaults applied in playback)
  velocity?: number;      // 0.0-1.0 dynamics. accent=0.9+, ghost=0.2-0.4
  articulation?: Articulation;
  attack?: number;        // seconds, overrides synth default
  release?: number;       // seconds, overrides synth default
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
  // Expressive feel (optional, hidden from user)
  swing?: number;   // 0.0-1.0: 0=straight, 0.5=moderate swing, 1.0=hard swing
  feel?: string;    // e.g. "medium swing", "straight with ghost notes"
}

export const GENRES: { value: Genre; label: string }[] = [
  { value: "jazz", label: "Jazz" },
  { value: "rnb", label: "R&B" },
  { value: "funk", label: "Funk" },
  { value: "blues", label: "Blues" },
  { value: "bossa", label: "Bossa Nova" },
];

export const BAR_OPTIONS = [2, 4, 6, 8] as const;
