/** Strip markdown fences and extract JSON from Claude's response */
export function extractJSON(text: string): string {
  // Strip ```json ... ``` wrapping
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Otherwise assume raw JSON
  return text.trim();
}

/** Duration values considered "long" (quarter note or longer) */
const LONG_DURATIONS = new Set(["4n", "4n.", "2n", "2n.", "1n"]);

/** All valid Tone.js durations mapped to approximate beat values for range checks */
const VALID_DURATIONS = new Set([
  "32n", "16n", "16n.", "8n", "8n.", "4n", "4n.", "2n", "2n.", "1n",
]);

/** Parse a scientific pitch string and return its MIDI-ish numeric value for range checking */
function pitchToMidi(pitch: string): number | null {
  if (pitch === "rest") return null;
  const match = pitch.match(/^([A-G])(b|#)?(\d)$/);
  if (!match) return null;
  const noteMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const base = noteMap[match[1]];
  if (base === undefined) return null;
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  const octave = parseInt(match[3]);
  return (octave + 1) * 12 + base + accidental;
}

// C3 = MIDI 48, F5 = MIDI 77
const MIN_PITCH = pitchToMidi("C3")!; // 48
const MAX_PITCH = pitchToMidi("F5")!; // 77

/**
 * Validate a parsed lick's notes array. Logs warnings for issues
 * but never rejects (graceful degradation).
 */
export function validateNotes(
  notes: Array<{ pitch: string; duration: string; [k: string]: unknown }>,
  bars: number,
): void {
  if (!notes || notes.length === 0) return;

  // 1. Check for at least 3 different duration values
  const durations = new Set(notes.map((n) => n.duration));
  if (durations.size < 3) {
    console.warn(
      `[lick-validate] Only ${durations.size} distinct duration(s) used (${[...durations].join(", ")}). Prefer at least 3 for rhythmic variety.`,
    );
  }

  // 2. Last note should be quarter note or longer
  const lastNote = notes[notes.length - 1];
  if (!LONG_DURATIONS.has(lastNote.duration)) {
    console.warn(
      `[lick-validate] Last note duration is "${lastNote.duration}". Prefer "4n" or longer for a strong ending.`,
    );
  }

  // 3. Pitched notes within C3-F5 range
  for (const note of notes) {
    if (note.pitch === "rest") continue;
    const midi = pitchToMidi(note.pitch);
    if (midi === null) {
      console.warn(`[lick-validate] Could not parse pitch "${note.pitch}".`);
      continue;
    }
    if (midi < MIN_PITCH || midi > MAX_PITCH) {
      console.warn(
        `[lick-validate] Pitch "${note.pitch}" is outside the C3-F5 range.`,
      );
    }
  }

  // 4. Reasonable note count
  const maxNotes = bars * 10; // ~10 notes per bar is very dense
  if (notes.length > Math.min(40, maxNotes)) {
    console.warn(
      `[lick-validate] ${notes.length} notes for ${bars} bars seems excessive (max ~${maxNotes}).`,
    );
  }
}
