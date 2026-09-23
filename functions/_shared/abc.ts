// Minimal ABC reader for validating generated licks (not a general ABC parser).
//
// It reads exactly the subset the generation prompt allows (headers, notes,
// rests, accidentals, octave marks, lengths, chord symbols, decorations, slurs,
// bar lines and repeats) and reports anything else as an error. The goal is to
// confirm that the ABC the model wrote encodes the same notes, in the same
// order, as its `notes` array, and that every bar fills the meter. The sheet
// music highlight (src/components/SheetMusic.tsx) maps the Nth ABC note/rest to
// notes[N], so constructs that change that 1:1 mapping (ties, grace notes,
// tuplets, stacked chords) are rejected rather than interpreted.

export interface AbcEvent {
  /** MIDI number, or null for a rest. */
  midi: number | null;
  /** Length in quarter-note beats. */
  beats: number;
}

export interface AbcParseResult {
  /** Quarter-note beats per bar from the M: header (null if unreadable). */
  beatsPerBar: number | null;
  /** Non-empty bars, in order. */
  bars: AbcEvent[][];
  errors: string[];
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_FIFTHS: Record<string, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
// Offset in fifths of each mode relative to its major (ionian) key signature.
const MODE_FIFTHS: Record<string, number> = {
  "": 0, maj: 0, ion: 0, mix: -1, dor: -2, m: -3, min: -3, aeo: -3, phr: -4, loc: -5, lyd: 1,
};

function parseFraction(s: string): number | null {
  const m = s.trim().match(/^(\d+)\/(\d+)$/);
  if (!m || Number(m[2]) === 0) return null;
  return Number(m[1]) / Number(m[2]);
}

/** Meter string ("4/4", "C", "C|") → quarter-note beats per bar. */
export function meterBeats(meter: string): number | null {
  const t = meter.trim();
  if (t === "C") return 4;
  if (t === "C|") return 2;
  const f = parseFraction(t);
  return f === null ? null : f * 4;
}

/** Key header ("Eb", "Bbm", "D dorian") → accidental per natural letter. */
export function keySignature(key: string): Record<string, number> | null {
  const t = key.trim();
  const sig: Record<string, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (t === "" || t.toLowerCase() === "none") return sig;
  const m = t.match(/^([A-G])([#b]?)\s*([A-Za-z]*)/);
  if (!m) return null;
  const mode = m[3].toLowerCase();
  const modeKey = mode === "m" ? "m" : mode.slice(0, 3);
  if (!(modeKey in MODE_FIFTHS)) return null;
  let fifths = LETTER_FIFTHS[m[1]] + (m[2] === "#" ? 7 : m[2] === "b" ? -7 : 0) + MODE_FIFTHS[modeKey];
  fifths = Math.max(-7, Math.min(7, fifths));
  if (fifths > 0) SHARP_ORDER.slice(0, fifths).forEach((l) => { sig[l] = 1; });
  if (fifths < 0) FLAT_ORDER.slice(0, -fifths).forEach((l) => { sig[l] = -1; });
  return sig;
}

export function parseAbc(abc: string): AbcParseResult {
  const errors: string[] = [];
  let meter: string | null = null;
  let unit: number | null = null;
  let key: string | null = null;
  const body: string[] = [];

  for (const rawLine of abc.split(/\r?\n/)) {
    const line = rawLine.replace(/%.*$/, "");
    const header = line.match(/^([A-Za-z]):(.*)$/);
    if (header && key === null) {
      // Header block: everything up to and including K:.
      if (header[1] === "M") meter = header[2];
      else if (header[1] === "L") unit = parseFraction(header[2]);
      else if (header[1] === "K") key = header[2];
      continue;
    }
    if (header) {
      errors.push(`unsupported field "${header[1]}:" in the tune body`);
      continue;
    }
    body.push(line);
  }

  if (key === null) errors.push("missing K: header");
  const beatsPerBar = meter === null ? null : meterBeats(meter);
  if (meter === null) errors.push("missing M: header");
  else if (beatsPerBar === null) errors.push(`unreadable meter "M:${meter.trim()}"`);
  // ABC default unit length is 1/8 for meters >= 3/4 (the prompt always sets L:).
  const unitBeats = (unit ?? 1 / 8) * 4;
  let sig = keySignature(key ?? "");
  if (!sig) {
    errors.push(`unreadable key "K:${(key ?? "").trim()}"`);
    sig = keySignature("C")!;
  }

  const bars: AbcEvent[][] = [];
  let bar: AbcEvent[] = [];
  let barAccidentals: Record<string, number> = {};
  let pendingBroken: number | null = null; // multiplier for the next note after > or <
  const closeBar = () => {
    if (bar.length > 0) bars.push(bar);
    bar = [];
    barAccidentals = {};
  };

  const src = body.join("\n");
  let i = 0;
  const fail = (msg: string) => errors.push(msg);

  while (i < src.length && errors.length === 0) {
    const c = src[i];

    if (/\s/.test(c) || c === "`" || c === "\\" || c === "y" || c === ")") { i++; continue; }
    if (c === '"' || c === "!" || c === "+") {
      const end = src.indexOf(c, i + 1);
      if (end === -1) { fail(`unterminated ${c}…${c}`); break; }
      i = end + 1;
      continue;
    }
    if (/[.~HLMOPSTuv]/.test(c)) { i++; continue; } // single-char decorations
    if (c === "(") {
      if (/\d/.test(src[i + 1] ?? "")) { fail("tuplets are not allowed (one ABC note per notes entry)"); break; }
      i++;
      continue; // slur start
    }
    if (c === "{") { fail("grace notes are not allowed (one ABC note per notes entry)"); break; }
    if (c === "-") { fail("ties are not allowed (one ABC note per notes entry)"); break; }
    if (c === "[") {
      const next = src[i + 1] ?? "";
      if (next === "|") { i += 2; closeBar(); continue; }
      if (/\d/.test(next)) { i++; while (/\d/.test(src[i] ?? "")) i++; continue; } // volta [1
      if (/[A-Za-z]/.test(next) && src[i + 2] === ":") { fail("inline fields are not allowed"); break; }
      fail("stacked chords are not allowed (the lick is a single melody line)");
      break;
    }
    if (c === "|" || c === ":") {
      while (/[|:\]]/.test(src[i] ?? "")) i++;
      while (/\d/.test(src[i] ?? "")) i++; // volta |1
      closeBar();
      continue;
    }
    if (c === ">" || c === "<") {
      let n = 0;
      while (src[i] === c) { n++; i++; }
      const prev = bar[bar.length - 1];
      if (!prev) { fail(`broken rhythm "${c}" without a preceding note`); break; }
      const short = 1 / 2 ** n;
      const long = 2 - short;
      prev.beats *= c === ">" ? long : short;
      pendingBroken = c === ">" ? short : long;
      continue;
    }

    // Note or rest.
    let accidental: number | null = null;
    const acc = src.slice(i).match(/^(\^\^|\^|__|_|=)/);
    if (acc) {
      accidental = { "^^": 2, "^": 1, "__": -2, "_": -1, "=": 0 }[acc[1]]!;
      i += acc[1].length;
    }
    const letter = src[i] ?? "";
    let midi: number | null;
    if (/[A-Ga-g]/.test(letter)) {
      i++;
      let octave = letter === letter.toUpperCase() ? 4 : 5;
      while (src[i] === "," || src[i] === "'") { octave += src[i] === "'" ? 1 : -1; i++; }
      const L = letter.toUpperCase();
      const slot = `${L}${octave}`;
      if (accidental !== null) barAccidentals[slot] = accidental;
      const alter = barAccidentals[slot] ?? sig[L];
      midi = (octave + 1) * 12 + LETTER_PC[L] + alter;
    } else if (letter === "z" && accidental === null) {
      i++;
      midi = null;
    } else {
      fail(`unsupported ABC symbol "${letter || c}"`);
      break;
    }

    const len = src.slice(i).match(/^(\d*)(\/*)(\d*)/)!;
    i += len[0].length;
    let mult = len[1] ? Number(len[1]) : 1;
    if (len[2]) mult /= len[3] ? Number(len[3]) * 2 ** (len[2].length - 1) : 2 ** len[2].length;
    else if (len[3]) { fail("malformed note length"); break; }
    let beats = mult * unitBeats;
    if (pendingBroken !== null) { beats *= pendingBroken; pendingBroken = null; }
    bar.push({ midi, beats });
  }
  closeBar();

  return { beatsPerBar, bars, errors };
}
