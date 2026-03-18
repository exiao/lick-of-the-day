/**
 * Standard virtual piano keyboard mapping.
 * The two keyboard rows interleave to mirror the piano layout:
 *
 *  | W| |E|   |T| |Y| |U|   |O| |P|
 *  |A| |S| |D| |F| |G| |H| |J| |K| |L| |;|
 *
 *  Maps to:
 *  | C#| |D#|   |F#| |G#| |A#|   |C#| |D#|
 *  |C | |D | |E | |F | |G | |A | |B | |C | |D | |E |
 *
 * Lower octave: A-row = white keys, W-row = black keys (interleaved)
 * Upper octave: K onwards continues, or Z-row for a second full octave
 */

// Lower octave: interleaved white + black keys from C
const LOWER_KEYS: Record<string, number> = {
  // White keys (A-row)
  "a": 0,   // C
  "s": 2,   // D
  "d": 4,   // E
  "f": 5,   // F
  "g": 7,   // G
  "h": 9,   // A
  "j": 11,  // B
  // Black keys (W-row, between the whites)
  "w": 1,   // C#
  "e": 3,   // D#
  "t": 6,   // F#
  "y": 8,   // G#
  "u": 10,  // A#
};

// Upper octave: continues from K
const UPPER_KEYS: Record<string, number> = {
  // White keys
  "k": 12,  // C
  "l": 14,  // D
  ";": 16,  // E
  // Black keys
  "o": 13,  // C#
  "p": 15,  // D#
};

const KEY_MAP: Record<string, number> = {
  ...LOWER_KEYS,
  ...UPPER_KEYS,
};

/**
 * Find the nearest C at or below a given MIDI note.
 */
export function nearestCBelow(midi: number): number {
  return midi - (midi % 12);
}

/**
 * Given a keyboard key and the anchor C MIDI note,
 * returns the MIDI note number, or null if the key isn't mapped.
 */
export function keyToMidi(key: string, anchorC: number): number | null {
  const offset = KEY_MAP[key.toLowerCase()];
  if (offset === undefined) return null;
  return anchorC + offset;
}

/** Get the keyboard label for a given MIDI note relative to anchor C */
export function midiToKeyLabel(midi: number, anchorC: number): string | null {
  const offset = midi - anchorC;
  if (offset < 0) return null;
  for (const [key, off] of Object.entries(KEY_MAP)) {
    if (off === offset) return key === ";" ? ";" : key.toUpperCase();
  }
  return null;
}
