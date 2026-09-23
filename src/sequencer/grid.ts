import type { Articulation, Chord, Note } from "../types/lick";
import { durationToBeats } from "../utils/music";

// Step-sequencer model for a lick: a 16th-note grid of pitched notes, plus the
// inverse mapping back to a Note[] and an ABC regenerator. Everything here is
// pure; the UI owns state.
//
// Design rules (the "display == sound" guarantee):
// - gridToNotes only emits durations playback understands ("16n" … "1n"), never
//   crosses a bar line or a splitAt step (chord change), and fills the form
//   exactly with notes + rests.
// - There are NO ties in this model. A pitched note that is too long for the
//   remaining space, or whose length has no single Tone duration (5, 7, 9 … steps),
//   is truncated to the largest representable length and the remainder becomes
//   rest. Use normalizeGrid() after an edit so the grid shows what will be heard.
// - notesToAbc renders the Note[] 1:1 (one ABC element per note/rest), so for any
//   gridToNotes output, parsing the ABC yields exactly the notes array.
//
// Chord bar/beat use quarter-note beats (matching src/test/lick-checks.ts), so a
// chord at beat b sits at step (b - 1) * STEPS_PER_BEAT within its bar.

export const STEPS_PER_BEAT = 4;

export interface GridNote {
  step: number;
  length: number;
  pitch: string;
  velocity?: number;
  articulation?: Articulation;
}

/** Pitched notes only, sorted by step, non-overlapping, length >= 1. */
export interface Grid {
  notes: GridNote[];
  totalSteps: number;
  stepsPerBar: number;
}

const DURATION_STEPS: Record<string, number> = {
  "16n": 1, "8n": 2, "8n.": 3, "4n": 4, "4n.": 6, "2n": 8, "2n.": 12, "1n": 16,
};
const STEPS_DURATION: Record<number, string> = Object.fromEntries(
  Object.entries(DURATION_STEPS).map(([d, s]) => [s, d]),
);
/** Step lengths with a single Tone duration, longest first. */
export const REPRESENTABLE_STEPS: readonly number[] = [16, 12, 8, 6, 4, 3, 2, 1];

export const DEFAULT_TRANSPOSE_RANGE: [number, number] = [48, 84];

// ---------------------------------------------------------------------------
// Time signature

function parseTimeSignature(ts: string): { num: number; den: number } {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(ts);
  if (!m) throw new Error(`Invalid time signature: ${ts}`);
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (num < 1 || ![1, 2, 4, 8, 16].includes(den)) throw new Error(`Unsupported time signature: ${ts}`);
  return { num, den };
}

/** 16th-note steps per bar: 4/4 -> 16, 3/4 -> 12, 6/8 -> 12. Throws on invalid input. */
export function stepsPerBar(timeSignature: string): number {
  const { num, den } = parseTimeSignature(timeSignature);
  return (num * 16) / den;
}

/** Steps per felt beat, used for beaming and rest grouping: quarter for x/4, dotted quarter for 6/8, 9/8, 12/8. */
export function beatSteps(timeSignature: string): number {
  const { num, den } = parseTimeSignature(timeSignature);
  if (den === 8 && num > 3 && num % 3 === 0) return 6;
  return 16 / den;
}

/** Step at which each chord starts (quarter-note beats), sorted, unique, excluding step 0. */
export function chordSplitSteps(chords: Chord[], timeSignature: string): number[] {
  const spb = stepsPerBar(timeSignature);
  const steps = new Set<number>();
  for (const c of chords) {
    const s = Math.round((c.bar - 1) * spb + (c.beat - 1) * STEPS_PER_BEAT);
    if (s > 0) steps.add(s);
  }
  return [...steps].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Pitch helpers (letter-based, so the spelling in the pitch string is kept)

interface SpelledPitch { letter: string; acc: number; octave: number; midi: number }

const LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "Eb4" -> { letter E, acc -1, octave 4, midi 63 }. Octave belongs to the letter (Cb4 = midi 59, as in Tone.js). */
export function spellPitch(pitch: string): SpelledPitch | null {
  const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(pitch);
  if (!m) return null;
  const acc = m[2] ? (m[2][0] === "#" ? m[2].length : -m[2].length) : 0;
  const octave = Number(m[3]);
  return { letter: m[1], acc, octave, midi: 12 * (octave + 1) + LETTER_SEMITONES[m[1]] + acc };
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** MIDI -> pitch string with the chosen accidental family (never Cb/E#/Fb/B#). */
export function midiToPitch(midi: number, spelling: "sharps" | "flats" = "sharps"): string {
  const names = spelling === "flats" ? FLAT_NAMES : SHARP_NAMES;
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

// ---------------------------------------------------------------------------
// Key signatures

const LETTER_FIFTHS: Record<string, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };
const MODE_OFFSET: [RegExp, number][] = [
  [/^(maj|major|ion)/, 0],
  [/^(min|minor|aeo|m$)/, -3],
  [/^dor/, -2],
  [/^phr/, -4],
  [/^lyd/, 1],
  [/^mix/, -1],
  [/^loc/, -5],
  [/^$/, 0],
];

/** Circle-of-fifths position of an ABC key string ("F" -> -1, "Dm" -> -1, "A" -> 3), or null if not understood. */
export function keyFifths(key: string): number | null {
  const m = /^\s*([A-G])([#b]?)\s*([A-Za-z]*)\s*$/.exec(key);
  if (!m) return null;
  const mode = m[3].toLowerCase();
  const entry = MODE_OFFSET.find(([re]) => re.test(mode));
  if (!entry) return null;
  const fifths = LETTER_FIFTHS[m[1]] + (m[2] === "#" ? 7 : m[2] === "b" ? -7 : 0) + entry[1];
  return fifths >= -7 && fifths <= 7 ? fifths : null;
}

/** Letter -> accidental from the key signature, e.g. K:F -> { B: -1 }. */
export function keySignatureAccidentals(key: string): Record<string, number> {
  const fifths = keyFifths(key) ?? 0;
  const out: Record<string, number> = {};
  if (fifths > 0) for (const l of "FCGDAEB".slice(0, fifths)) out[l] = 1;
  if (fifths < 0) for (const l of "BEADGCF".slice(0, -fifths)) out[l] = -1;
  return out;
}

/** Sharps for sharp keys and C/Am, flats for flat keys. */
export function spellingForKey(key: string): "sharps" | "flats" {
  return (keyFifths(key) ?? 0) < 0 ? "flats" : "sharps";
}

// ---------------------------------------------------------------------------
// Notes <-> grid

/**
 * Map a Note[] onto the 16th grid. Returns null if the time signature is invalid,
 * `bars` < 1, a pitch is unparseable, or any note/rest inside the form has a
 * duration that isn't a whole number of 16ths ("32n", "16n.", triplets, unknown).
 * Notes/rests starting at or beyond the form are ignored; a note running past the
 * end is clipped to it.
 */
export function notesToGrid(notes: Note[], bars: number, timeSignature: string): Grid | null {
  let spb: number;
  try {
    spb = stepsPerBar(timeSignature);
  } catch {
    return null;
  }
  if (!Number.isInteger(bars) || bars < 1 || !Number.isInteger(spb)) return null;
  const totalSteps = bars * spb;
  const out: GridNote[] = [];
  let cursor = 0;
  for (const n of notes) {
    if (cursor >= totalSteps) break;
    const len = DURATION_STEPS[n.duration];
    if (len === undefined) return null;
    if (n.pitch !== "rest") {
      if (!spellPitch(n.pitch)) return null;
      out.push(withExpression({ step: cursor, length: Math.min(len, totalSteps - cursor), pitch: n.pitch }, n));
    }
    cursor += len;
  }
  return { notes: out, totalSteps, stepsPerBar: spb };
}

function withExpression<T extends object>(target: T, src: { velocity?: number; articulation?: Articulation }): T & { velocity?: number; articulation?: Articulation } {
  const out: T & { velocity?: number; articulation?: Articulation } = { ...target };
  if (src.velocity !== undefined) out.velocity = src.velocity;
  if (src.articulation !== undefined) out.articulation = src.articulation;
  return out;
}

function largestRepresentable(max: number): number {
  return REPRESENTABLE_STEPS.find((s) => s <= max) ?? 0;
}

/**
 * Grid -> Note[] filling exactly totalSteps. Pitched notes never cross a bar line or
 * a splitAt step and are truncated to the largest representable length (no ties);
 * the remainder becomes rest. Rests are chunked so they don't cross bar lines or
 * splitAt steps and start aligned (a 2-step rest on an 8th, a quarter on a beat, …).
 * Overlapping/out-of-range grid notes are dropped (later onset loses).
 */
export function gridToNotes(grid: Grid, opts: { splitAt?: number[] } = {}): Note[] {
  const { totalSteps: total, stepsPerBar: spb } = grid;
  const bounds = new Set<number>([total]);
  for (let b = spb; b < total; b += spb) bounds.add(b);
  for (const s of opts.splitAt ?? []) if (Number.isInteger(s) && s > 0 && s < total) bounds.add(s);
  const boundaries = [...bounds].sort((a, b) => a - b);
  const nextBoundary = (p: number) => boundaries.find((b) => b > p) ?? total;

  const out: Note[] = [];
  const pushRests = (from: number, to: number) => {
    let p = from;
    while (p < to) {
      const segEnd = Math.min(to, nextBoundary(p));
      const rel = p - Math.floor(p / spb) * spb;
      const c = REPRESENTABLE_STEPS.find((len) => len <= segEnd - p && restAligned(rel, len))!;
      out.push({ pitch: "rest", duration: STEPS_DURATION[c] });
      p += c;
    }
  };

  const sorted = grid.notes
    .filter((n) => Number.isInteger(n.step) && Number.isInteger(n.length) && n.length >= 1 && n.step >= 0 && n.step < total)
    .sort((a, b) => a.step - b.step);
  let cursor = 0;
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    if (n.step < cursor) continue;
    pushRests(cursor, n.step);
    const nextOnset = sorted.slice(i + 1).find((m) => m.step > n.step)?.step ?? total;
    const len = largestRepresentable(Math.min(n.length, nextBoundary(n.step) - n.step, nextOnset - n.step));
    out.push(withExpression({ pitch: n.pitch, duration: STEPS_DURATION[len] }, n));
    cursor = n.step + len;
  }
  pushRests(cursor, total);
  return out;
}

/** Rests start where their own length divides the bar position; the only dotted rest is a 12-step one from the downbeat. */
function restAligned(rel: number, len: number): boolean {
  if (len === 12) return rel === 0;
  if (len === 6 || len === 3) return false;
  return rel % len === 0;
}

/** Round-trip through gridToNotes so the grid shows exactly what will be heard/notated. */
export function normalizeGrid(grid: Grid, opts: { splitAt?: number[] } = {}): Grid {
  const notes = gridToNotes(grid, opts);
  let cursor = 0;
  const out: GridNote[] = [];
  for (const n of notes) {
    const len = DURATION_STEPS[n.duration];
    if (n.pitch !== "rest") out.push(withExpression({ step: cursor, length: len, pitch: n.pitch }, n));
    cursor += len;
  }
  return { ...grid, notes: out };
}

// ---------------------------------------------------------------------------
// Editing

export function noteAtStep(grid: Grid, step: number): { note: GridNote; index: number; isOnset: boolean } | null {
  const index = grid.notes.findIndex((n) => n.step <= step && step < n.step + n.length);
  if (index === -1) return null;
  const note = grid.notes[index];
  return { note, index, isOnset: note.step === step };
}

/**
 * Onset -> remove the note (armed null). Inside a sustain -> split: the covering note
 * ends at `step`, a new note with its pitch starts there (armed = step). Silence -> new
 * note with fallbackPitch, length min(2, next onset, bar line) (armed = step).
 */
export function toggleStep(grid: Grid, step: number, fallbackPitch: string): { grid: Grid; armed: number | null } {
  if (!Number.isInteger(step) || step < 0 || step >= grid.totalSteps) return { grid, armed: null };
  const hit = noteAtStep(grid, step);
  const notes = [...grid.notes];
  if (hit?.isOnset) {
    notes.splice(hit.index, 1);
    return { grid: { ...grid, notes }, armed: null };
  }
  if (hit) {
    const { note, index } = hit;
    const tail = withExpression({ step, length: note.step + note.length - step, pitch: note.pitch }, note);
    notes.splice(index, 1, { ...note, length: step - note.step }, tail);
    return { grid: { ...grid, notes }, armed: step };
  }
  const nextOnset = grid.notes.find((n) => n.step > step)?.step ?? grid.totalSteps;
  const barEnd = (Math.floor(step / grid.stepsPerBar) + 1) * grid.stepsPerBar;
  const length = Math.min(2, nextOnset - step, barEnd - step, grid.totalSteps - step);
  const at = notes.findIndex((n) => n.step > step);
  notes.splice(at === -1 ? notes.length : at, 0, { step, length, pitch: fallbackPitch });
  return { grid: { ...grid, notes }, armed: step };
}

/** Replace the pitch of the note starting at `step`. No-op if `step` isn't an onset or the pitch is invalid. */
export function setStepPitch(grid: Grid, step: number, pitch: string): Grid {
  const hit = noteAtStep(grid, step);
  if (!hit?.isOnset || !spellPitch(pitch)) return grid;
  const notes = [...grid.notes];
  notes[hit.index] = { ...hit.note, pitch };
  return { ...grid, notes };
}

/**
 * Transpose the note covering `step` (onset or sustain) by `semitones`, clamped to
 * the MIDI range (default 48..84). The result is spelled with `spelling`, or, if
 * omitted, flats when the original pitch was flat and sharps otherwise. No-op on silence.
 */
export function transposeStep(
  grid: Grid,
  step: number,
  semitones: number,
  range: [number, number] = DEFAULT_TRANSPOSE_RANGE,
  spelling?: "sharps" | "flats",
): Grid {
  const hit = noteAtStep(grid, step);
  const spelled = hit && spellPitch(hit.note.pitch);
  if (!hit || !spelled) return grid;
  const midi = Math.min(range[1], Math.max(range[0], spelled.midi + Math.round(semitones)));
  const pitch = midi === spelled.midi ? hit.note.pitch : midiToPitch(midi, spelling ?? (spelled.acc < 0 ? "flats" : "sharps"));
  if (pitch === hit.note.pitch) return grid;
  const notes = [...grid.notes];
  notes[hit.index] = { ...hit.note, pitch };
  return { ...grid, notes };
}

// ---------------------------------------------------------------------------
// ABC

const ACC_TEXT: Record<number, string> = { [-2]: "__", [-1]: "_", 0: "=", 1: "^", 2: "^^" };

function abcLength(units32: number): string {
  // L:1/16, so one unit here is half an ABC unit.
  if (units32 % 2 === 0) return units32 === 2 ? "" : String(units32 / 2);
  return `${units32 === 1 ? "" : units32}/2`;
}

function abcLetter(letter: string, octave: number): string {
  return octave >= 5 ? letter.toLowerCase() + "'".repeat(octave - 5) : letter + ",".repeat(4 - octave);
}

/**
 * Render notes as ABC (L:1/16), one element per note/rest so the notation and the
 * notes array agree 1:1. Durations come from durationToBeats (what playback uses).
 * Accidentals follow the key signature with bar-scoped carry, keeping the pitch
 * string's spelling (Eb4 -> _E unless the key already flats E). Chords attach to the
 * element starting at their bar/beat, else to the element covering it.
 *
 * Edge cases (gridToNotes never produces these): notes that cross a bar line are
 * split with ABC ties; if the notes don't fill the form, the ABC is padded with rests;
 * notes starting after the form are dropped. An unrecognised key renders as K:C.
 */
export function notesToAbc(
  notes: Note[],
  meta: { key: string; timeSignature: string; bars: number; chords: Chord[]; title?: string },
): string {
  const spb = stepsPerBar(meta.timeSignature);
  const barU = spb * 2; // 32nd-note units
  const beatU = beatSteps(meta.timeSignature) * 2;
  const totalU = meta.bars * barU;
  const key = keyFifths(meta.key) === null ? "C" : meta.key.trim();
  const keyAcc = keySignatureAccidentals(key);

  interface El { onset: number; len: number; pitch: SpelledPitch | null; tie: boolean }
  const els: El[] = [];
  let pos = 0;
  for (const n of notes) {
    if (pos >= totalU) break;
    const spelled = n.pitch === "rest" ? null : spellPitch(n.pitch);
    if (n.pitch !== "rest" && !spelled) throw new Error(`Invalid pitch: ${n.pitch}`);
    let remaining = Math.min(Math.round(durationToBeats(n.duration) * 8), totalU - pos);
    while (remaining > 0) {
      const piece = Math.min(remaining, (Math.floor(pos / barU) + 1) * barU - pos);
      remaining -= piece;
      els.push({ onset: pos, len: piece, pitch: spelled, tie: spelled !== null && remaining > 0 });
      pos += piece;
    }
  }
  while (pos < totalU) {
    const piece = (Math.floor(pos / barU) + 1) * barU - pos;
    els.push({ onset: pos, len: piece, pitch: null, tie: false });
    pos += piece;
  }

  const chordText = new Map<El, string[]>();
  for (const c of meta.chords) {
    const at = Math.round(((c.bar - 1) * spb + (c.beat - 1) * STEPS_PER_BEAT) * 2);
    const el = els.find((e) => e.onset === at) ?? els.find((e) => e.onset <= at && at < e.onset + e.len);
    if (!el) continue;
    chordText.set(el, [...(chordText.get(el) ?? []), c.chord.replace(/"/g, "")]);
  }

  const barTexts: string[] = Array.from({ length: meta.bars }, () => "");
  let barAcc: Record<string, number> = {};
  let currentBar = -1;
  for (const el of els) {
    const bar = Math.floor(el.onset / barU);
    if (bar !== currentBar) {
      currentBar = bar;
      barAcc = {};
    }
    const rel = el.onset - bar * barU;
    let text = (chordText.get(el) ?? []).map((c) => `"${c}"`).join("");
    if (el.pitch) {
      const { letter, acc, octave } = el.pitch;
      const id = `${letter}${octave}`;
      const sounding = barAcc[id] ?? keyAcc[letter] ?? 0;
      if (acc !== sounding) {
        text += ACC_TEXT[acc];
        barAcc[id] = acc;
      }
      text += abcLetter(letter, octave);
    } else {
      text += "z";
    }
    text += abcLength(el.len) + (el.tie ? "-" : "");
    const sep = barTexts[bar] === "" ? "" : rel % beatU === 0 ? " " : "";
    barTexts[bar] += sep + text;
  }

  let body = "";
  barTexts.forEach((t, i) => {
    const last = i === barTexts.length - 1;
    body += t + (last ? "|]" : "|");
    if (!last) body += meta.bars > 4 && (i + 1) % 4 === 0 ? "\n" : " ";
  });

  const header = ["X:1"];
  if (meta.title) header.push(`T:${meta.title.replace(/[\r\n]+/g, " ")}`);
  header.push(`M:${meta.timeSignature.trim()}`, "L:1/16", `K:${key}`);
  return `${header.join("\n")}\n${body}`;
}
