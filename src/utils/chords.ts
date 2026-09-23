// Chord symbol parser and shell voicer for chord playback

const NOTE_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8,
  Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

const SEMITONE_TO_NOTE = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function semitoneToNote(semitone: number): string {
  return SEMITONE_TO_NOTE[((semitone % 12) + 12) % 12];
}

// Parse root note from chord symbol, return [root, remaining]
function parseRoot(chord: string): [string, string] {
  const match = chord.match(/^([A-G][b#]?)(.*)/);
  if (!match) return ["C", chord];
  return [match[1], match[2]];
}

// Map chord quality to intervals above root (semitones)
// Using shell voicings: root + 3rd + 7th (omit 5th mostly)
function qualityToIntervals(quality: string): number[] {
  const q = quality
    .replace(/add\d+/g, "")   // strip addX
    .replace(/[#b]\d+/g, "")  // strip alterations like #11, b9
    .replace(/\(.*\)/g, "")   // strip parenthesized alterations
    .trim();

  if (q === "maj7" || q === "M7" || q === "Δ7" || q === "Δ") return [0, 4, 11];
  if (q === "maj9" || q === "M9") return [0, 4, 11];
  if (q === "maj" || q === "M" || q === "") return [0, 4, 7];
  if (q === "m7" || q === "min7" || q === "-7") return [0, 3, 10];
  if (q === "m9" || q === "min9") return [0, 3, 10];
  if (q === "m" || q === "min" || q === "-") return [0, 3, 7];
  if (q === "7" || q === "dom7") return [0, 4, 10];
  if (q === "9") return [0, 4, 10];
  if (q === "13") return [0, 4, 10];
  if (q === "m7b5" || q === "ø7" || q === "ø" || q === "-7b5") return [0, 3, 6, 10];
  if (q === "dim7" || q === "o7") return [0, 3, 6, 9];
  if (q === "dim" || q === "o") return [0, 3, 6];
  if (q === "aug" || q === "+") return [0, 4, 8];
  if (q === "sus2") return [0, 2, 7];
  if (q === "sus4" || q === "sus") return [0, 5, 7];
  if (q === "6") return [0, 4, 7, 9];
  if (q === "m6") return [0, 3, 7, 9];
  // fallback: major triad
  return [0, 4, 7];
}

// Convert chord symbol to array of Tone.js pitch strings
// Rooted at given octave (default 3 — stays below the lick)
export function chordToNotes(chord: string, octave = 3): string[] {
  const [root, quality] = parseRoot(chord);
  const rootSemitone = NOTE_SEMITONES[root] ?? 0;
  const intervals = qualityToIntervals(quality);

  return intervals.map((interval, i) => {
    const semitone = rootSemitone + interval;
    let oct = octave;

    // Keep voicing in a reasonable range (C3–B4)
    if (i === 0 && semitone > 5) oct = octave - 1; // root stays low

    const noteName = semitoneToNote(semitone);
    return `${noteName}${oct}`;
  });
}

// Convert bar+beat position to seconds
export function chordTimeToSeconds(
  bar: number,
  beat: number,
  tempo: number,
  beatsPerBar = 4,
): number {
  const secondsPerBeat = 60 / tempo;
  return ((bar - 1) * beatsPerBar + (beat - 1)) * secondsPerBeat;
}

// --- Theory helpers for the display, piano chord-tone dots and comping ---

/** Root pitch class (0-11) of a chord symbol, or null if it has no root. */
export function chordRootPc(chord: string): number | null {
  const m = chord.match(/^([A-G][b#]?)/);
  return m ? NOTE_SEMITONES[m[1]] ?? null : null;
}

/**
 * Chord-tone intervals (root, 3rd, 5th, 7th/6th) for common jazz qualities.
 * Unlike qualityToIntervals (a shell voicer that drops alterations), this keeps
 * the b5 of half-diminished chords and the 6th of m6/6 chords.
 */
export function chordToneIntervals(chord: string): number[] {
  const q = parseRoot(chord)[1];
  if (/^(m7b5|ø|-7b5|min7b5)/.test(q)) return [0, 3, 6, 10];
  if (/^(dim7|o7)/.test(q)) return [0, 3, 6, 9];
  if (/^(dim|o)/.test(q)) return [0, 3, 6];
  if (/^(maj|M|Δ)/.test(q)) return /^(maj|M|Δ)\d/.test(q) || q === "Δ" ? [0, 4, 7, 11] : [0, 4, 7];
  if (/^(m6|min6|-6)/.test(q)) return [0, 3, 7, 9];
  if (/^(m|min|-)/.test(q)) return /\d/.test(q) ? [0, 3, 7, 10] : [0, 3, 7];
  if (/^6/.test(q)) return [0, 4, 7, 9];
  if (/^(aug|\+)/.test(q)) return [0, 4, 8];
  if (/^sus/.test(q)) return [0, 5, 7, 10];
  if (/^(7|9|11|13)/.test(q)) return [0, 4, 7, 10];
  return [0, 4, 7];
}

/** Pitch classes (0-11) of the chord tones. */
export function chordPitchClasses(chord: string): number[] {
  const root = chordRootPc(chord);
  if (root === null) return [];
  return chordToneIntervals(chord).map((i) => (root + i) % 12);
}

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/**
 * Chord-tone names spelled by scale degree (3rd on the letter two up from the
 * root, 5th four up, 7th/6th six/five up), e.g. C7 → C E G Bb, A7b9 → A C# E G.
 */
export function chordToneNames(chord: string): string[] {
  const root = chordRootPc(chord);
  if (root === null) return [];
  const rootLetter = LETTERS.indexOf(chord[0]);
  return chordToneIntervals(chord).map((iv, i) => {
    // Degree steps: R=0, 3rd=2, 5th=4, and the 4th tone is a 6th (9) or 7th (10/11).
    const steps = [0, 2, 4, iv === 9 ? 5 : 6][i];
    const letterIdx = (rootLetter + steps) % 7;
    const pc = (root + iv) % 12;
    let diff = (pc - LETTER_PC[letterIdx] + 12) % 12;
    if (diff > 6) diff -= 12;
    const acc = diff > 0 ? "#".repeat(diff) : "b".repeat(-diff);
    return LETTERS[letterIdx] + acc;
  });
}

const DEGREE_LABELS = ["R", "b9", "9", "b3", "3", "11", "b5", "5", "b13", "6", "b7", "7"];

/**
 * Function of a melody note over a chord, e.g. A over Fmaj7 → "3".
 * Minor chords read the minor third as "b3"; dominants read a raised 9th as "#9".
 */
export function degreeOver(chord: string, midi: number): string | null {
  const root = chordRootPc(chord);
  if (root === null) return null;
  const iv = (((midi - root) % 12) + 12) % 12;
  const tones = chordToneIntervals(chord);
  if (iv === 3 && tones.includes(4)) return "#9";
  if (iv === 9 && tones.includes(10) && tones.includes(3)) return "13";
  if (iv === 8 && tones.includes(8)) return "#5";
  return DEGREE_LABELS[iv];
}

/** True when the interval is one of the chord's own tones (R/3/5/7 or 6). */
export function isChordTone(chord: string, midi: number): boolean {
  return chordPitchClasses(chord).includes(((midi % 12) + 12) % 12);
}

/**
 * A rootless-ish left-hand comp: bass root in octave 2 plus a guide-tone shell
 * (3rd + 7th, or 3rd + 6th) voiced between E3 and D4 so it sits under the lick.
 */
export function compVoicing(chord: string): { bass: string; shell: string[] } | null {
  const root = chordRootPc(chord);
  if (root === null) return null;
  const tones = chordToneIntervals(chord);
  const third = tones[1];
  const top = tones.length > 3 ? tones[3] : tones[2];
  const place = (pc: number) => {
    // Lowest octave placing the pitch class at or above E3 (MIDI 52).
    let midi = 48 + pc;
    if (midi < 52) midi += 12;
    return midi;
  };
  const name = (midi: number) => `${SEMITONE_TO_NOTE[midi % 12]}${Math.floor(midi / 12) - 1}`;
  const shell = [place((root + third) % 12), place((root + top) % 12)].sort((a, b) => a - b);
  return { bass: name(36 + root), shell: shell.map(name) };
}

/** The chord active at a beat offset (chords sorted by bar/beat). */
export function chordAtBeat<T extends { bar: number; beat: number }>(
  chords: T[],
  beat: number,
  beatsPerBar: number,
): { chord: T; index: number } | null {
  let found: { chord: T; index: number } | null = null;
  chords.forEach((c, index) => {
    if ((c.bar - 1) * beatsPerBar + (c.beat - 1) <= beat + 1e-6) found = { chord: c, index };
  });
  return found;
}
