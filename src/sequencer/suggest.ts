import type { Chord } from "../types/lick";
import { chordAtBeat, chordPitchClasses } from "../utils/chords";
import { midiToNote } from "../utils/music";

const LOW = 60; // C4
const HIGH = 76; // E5

/**
 * The pitch a newly lit step starts on: the chord tone (of the chord active at
 * that step) nearest the previous melody note, kept in the practice range C4..E5.
 * With no previous note, lands near G4; with no chord, repeats the previous pitch.
 */
export function suggestPitch(
  chords: Chord[],
  beatsPerBar: number,
  step: number,
  prevMidi: number | null,
): string {
  const anchor = prevMidi ?? 67;
  const sorted = [...chords].sort((a, b) => a.bar - b.bar || a.beat - b.beat);
  const active = chordAtBeat(sorted, step / 4, beatsPerBar);
  const pcs = active ? chordPitchClasses(active.chord.chord) : [];
  if (pcs.length === 0) return midiToNote(Math.min(HIGH, Math.max(LOW, anchor)));

  let best = LOW;
  let bestDist = Infinity;
  for (let m = LOW; m <= HIGH; m++) {
    if (!pcs.includes(m % 12)) continue;
    // Prefer stepping to a new tone over repeating the previous one.
    const dist = Math.abs(m - anchor) + (m === prevMidi ? 2.5 : 0);
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }
  return midiToNote(best);
}
