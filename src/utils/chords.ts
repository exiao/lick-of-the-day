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
    let semitone = rootSemitone + interval;
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
