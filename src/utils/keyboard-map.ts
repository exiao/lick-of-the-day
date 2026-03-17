/**
 * Maps computer keyboard keys to piano semitone offsets from the base note.
 * Lower octave: A-row (white) + Q/W-row (black)
 * Upper octave: Z-row (white) + contextual blacks
 */

// Lower octave: white keys
const LOWER_WHITE: Record<string, number> = {
  "a": 0,   // C
  "s": 2,   // D
  "d": 4,   // E
  "f": 5,   // F
  "g": 7,   // G
  "h": 9,   // A
  "j": 11,  // B
  "k": 12,  // C (next octave)
};

// Lower octave: black keys
const LOWER_BLACK: Record<string, number> = {
  "w": 1,   // C#
  "e": 3,   // D#
  // R skipped to match physical spacing
  "t": 6,   // F#
  "y": 8,   // G#
  "u": 10,  // A#
};

// Upper octave: white keys
const UPPER_WHITE: Record<string, number> = {
  "z": 12,  // C
  "x": 14,  // D
  "c": 16,  // E
  "v": 17,  // F
  "b": 19,  // G
  "n": 21,  // A
  "m": 23,  // B
  ",": 24,  // C (next octave)
};

// Upper octave: black keys (between Z-row whites)
const UPPER_BLACK: Record<string, number> = {
  // Using shifted number row isn't great; reuse available keys
  // These sit between the Z-row on a QWERTY layout
};

// Combined map
const KEY_MAP: Record<string, number> = {
  ...LOWER_WHITE,
  ...LOWER_BLACK,
  ...UPPER_WHITE,
  ...UPPER_BLACK,
};

/**
 * Given a keyboard key and the base MIDI note of the piano,
 * returns the MIDI note number, or null if the key isn't mapped.
 */
export function keyToMidi(key: string, baseMidi: number): number | null {
  const offset = KEY_MAP[key.toLowerCase()];
  if (offset === undefined) return null;
  return baseMidi + offset;
}

/** Get all mapped keyboard keys */
export function getAllMappedKeys(): string[] {
  return Object.keys(KEY_MAP);
}

/** Get the keyboard label for a given MIDI note relative to base */
export function midiToKeyLabel(midi: number, baseMidi: number): string | null {
  const offset = midi - baseMidi;
  for (const [key, off] of Object.entries(KEY_MAP)) {
    if (off === offset) return key.toUpperCase();
  }
  return null;
}
