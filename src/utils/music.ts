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
  const octave = parseInt(match[2]);

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
export function computePianoRange(notes: { pitch: string }[]): { low: number; high: number } {
  if (notes.length === 0) {
    return { low: 48, high: 83 }; // C3 to B5 (3 octaves)
  }

  const midis = notes.map(n => parsePitch(n.pitch).midi);
  const minNote = Math.min(...midis);
  const maxNote = Math.max(...midis);

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

/** Rescale note times for a different tempo */
export function rescaleNoteTimes(
  notes: { pitch: string; duration: string; time: number }[],
  originalTempo: number,
  newTempo: number,
): { pitch: string; duration: string; time: number }[] {
  const ratio = originalTempo / newTempo;
  return notes.map(n => ({ ...n, time: n.time * ratio }));
}
