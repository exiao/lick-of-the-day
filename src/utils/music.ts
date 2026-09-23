const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const ENHARMONIC_MAP: Record<string, string> = {
  "Db": "C#", "Eb": "D#", "Fb": "E", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B",
  "E#": "F", "B#": "C",
};

/** Parse "C#4" → { name: "C#", octave: 4, midi: 61 } */
export function parsePitch(pitch: string): { name: string; octave: number; midi: number } {
  const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) throw new Error(`Invalid pitch: ${pitch}`);

  let name = match[1];
  let octave = parseInt(match[2]);
  // Cb4 is B3 and B#4 is C5: the octave number follows the letter, not the sound.
  if (name === "Cb") octave -= 1;
  if (name === "B#") octave += 1;

  // Normalize to sharps
  if (ENHARMONIC_MAP[name]) name = ENHARMONIC_MAP[name];

  const noteIndex = NOTE_NAMES.indexOf(name);
  if (noteIndex === -1) throw new Error(`Unknown note: ${name}`);

  const midi = (octave + 1) * 12 + noteIndex;
  return { name, octave, midi };
}

/** Convert MIDI number to note name + octave, e.g. 60 → "C4" */
export function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/** Check if a MIDI note is a black key */
export function isBlackKey(midi: number): boolean {
  const n = midi % 12;
  return [1, 3, 6, 8, 10].includes(n);
}

/**
 * Compute piano range: always starts on C, always ends on B,
 * covers at least 2 octaves, centered around the lick's notes.
 */
export function computePianoRange(
  notes: { pitch: string }[],
  { compact = false }: { compact?: boolean } = {},
): { low: number; high: number } {
  if (notes.length === 0) {
    return { low: 48, high: 83 }; // C3 to B5 (3 octaves)
  }

  // Rests (and anything unparseable) don't affect the keyboard range.
  const midis = notes
    .map(n => pitchToMidiOrNull(n.pitch))
    .filter((m): m is number => m !== null);
  if (midis.length === 0) return { low: 48, high: 83 };
  const minNote = Math.min(...midis);
  const maxNote = Math.max(...midis);

  // Narrow screens: just the octaves the lick actually uses, C to B.
  if (compact) {
    const low = minNote - (minNote % 12);
    let high = maxNote - (maxNote % 12) + 11;
    if (high - low < 11) high = low + 11;
    return { low, high };
  }

  // Start on C at or below the lowest note (with some padding)
  let low = minNote - 5;
  low = low - (low % 12); // snap down to nearest C

  // End on B at or above the highest note (with some padding)
  let high = maxNote + 5;
  high = high - (high % 12) + 11; // snap up to nearest B

  // Ensure minimum 2 octaves
  while (high - low < 23) {
    high += 12;
  }

  return { low, high };
}

/** Check if two pitches are enharmonically equivalent */
export function pitchesMatch(a: string, b: string): boolean {
  try {
    return parsePitch(a).midi === parsePitch(b).midi;
  } catch {
    return false;
  }
}



/** MIDI for a pitch, or null for "rest"/unparseable pitches. */
export function pitchToMidiOrNull(pitch: string): number | null {
  try {
    return parsePitch(pitch).midi;
  } catch {
    return null;
  }
}

/** Tone.js duration string → length in quarter-note beats. */
export function durationToBeats(dur: string): number {
  switch (dur) {
    case "1n":  return 4;
    case "2n":  return 2;
    case "2n.": return 3;
    case "4n":  return 1;
    case "4n.": return 1.5;
    case "8n":  return 0.5;
    case "8n.": return 0.75;
    case "16n": return 0.25;
    case "16n.": return 0.375;
    case "32n": return 0.125;
    default:    return 0.5; // fallback to eighth
  }
}

/** Beat onset (from 0) of every note, rests included. */
export function noteOnsets(notes: { duration: string }[]): number[] {
  let cursor = 0;
  return notes.map((n) => {
    const at = cursor;
    cursor += durationToBeats(n.duration);
    return at;
  });
}
