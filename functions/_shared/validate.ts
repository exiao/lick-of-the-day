// Structural validation of a generated lick, run server-side before a lick is
// served or cached. validateNotes (parse.ts) only logs style hints; this module
// decides whether a lick is usable at all.
//
// Two tiers:
//   fatal  - the lick cannot play or render (no notes, unparseable pitch,
//            unknown duration, no ABC). Every path rejects these.
//   strict - the lick plays but is wrong against the grid: notes do not fill
//            the bars, the ABC disagrees with the notes array (the sheet-music
//            highlight and practice target then point at different notes), or
//            the chord chart cannot drive the backing track. The daily cron
//            rejects these and regenerates; request paths return a safe fallback or error.

import { keySignature, meterBeats, parseAbc } from "./abc";
import { DURATION_BEATS } from "./durations";

export interface LickIssues {
  fatal: string[];
  strict: string[];
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const EPS = 1e-6;

/** Scientific pitch → MIDI, restricted to what the client's parsePitch accepts. */
function pitchMidi(pitch: string): number | null {
  const m = pitch.match(/^([A-G])([#b]?)(\d)$/);
  if (!m) return null;
  return (Number(m[3]) + 1) * 12 + PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

function fmtBeats(b: number): string {
  return Number.isInteger(b) ? String(b) : b.toFixed(3).replace(/0+$/, "");
}

export function checkLick(lick: unknown, expectedBars: number): LickIssues {
  const fatal: string[] = [];
  const strict: string[] = [];
  if (!lick || typeof lick !== "object" || Array.isArray(lick)) return { fatal: ["lick is not an object"], strict };
  const l = lick as Record<string, unknown>;

  // --- fatal: can it play and render at all? ---
  if (typeof l.title !== "string" || !l.title.trim()) fatal.push("title must be a non-empty string");
  if (typeof l.genre !== "string" || !["jazz", "blues", "funk", "rnb", "bossa"].includes(l.genre)) fatal.push("genre is unsupported");
  if (typeof l.key !== "string" || !/^[A-G][#b]?(?:\s*[A-Za-z]+)?$/.test(l.key.trim()) || keySignature(l.key) === null) fatal.push("key must be a readable key signature");
  if (typeof l.tempo !== "number" || !Number.isFinite(l.tempo) || l.tempo < 40 || l.tempo > 240) fatal.push("tempo must be between 40 and 240");
  if (typeof l.bars !== "number" || !Number.isInteger(l.bars) || l.bars < 1) fatal.push("bars must be a positive integer");
  const timeSig = typeof l.timeSignature === "string" ? l.timeSignature : "";
  const beatsPerBar = meterBeats(timeSig);
  if (beatsPerBar === null || !Number.isFinite(beatsPerBar) || beatsPerBar <= 0 || !/^(?:C\|?|[1-9]\d*\/(?:1|2|4|8|16|32|64))$/.test(timeSig.trim())) fatal.push("timeSignature must be a positive readable meter");
  if (l.swing !== undefined && (typeof l.swing !== "number" || !Number.isFinite(l.swing) || l.swing < 0 || l.swing > 1)) fatal.push("swing must be between 0 and 1");
  if (l.feel !== undefined && typeof l.feel !== "string") fatal.push("feel must be a string");
  const notes = l.notes;
  if (!Array.isArray(notes) || notes.length === 0) {
    fatal.push("notes must be a non-empty array");
  } else {
    notes.forEach((n, idx) => {
      const note = n as { pitch?: unknown; duration?: unknown; velocity?: unknown; articulation?: unknown; attack?: unknown; release?: unknown } | null;
      if (!note || typeof note.pitch !== "string" || typeof note.duration !== "string") {
        fatal.push(`notes[${idx}] needs string pitch and duration`);
        return;
      }
      if (note.velocity !== undefined && (typeof note.velocity !== "number" || !Number.isFinite(note.velocity) || note.velocity < 0 || note.velocity > 1)) fatal.push(`notes[${idx}] velocity must be between 0 and 1`);
      if (note.articulation !== undefined && (typeof note.articulation !== "string" || !["normal", "staccato", "legato", "accent", "ghost"].includes(note.articulation))) fatal.push(`notes[${idx}] articulation is unsupported`);
      for (const field of ["attack", "release"] as const) {
        const value = note[field];
        if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) fatal.push(`notes[${idx}] ${field} must be a non-negative number`);
      }
      if (note.pitch !== "rest" && pitchMidi(note.pitch) === null) {
        fatal.push(`notes[${idx}] has unplayable pitch "${note.pitch}"`);
      }
      if (!Object.hasOwn(DURATION_BEATS, note.duration)) {
        fatal.push(`notes[${idx}] has unknown duration "${note.duration}"`);
      }
    });
  }
  if (typeof l.abc !== "string" || l.abc.trim() === "") fatal.push("abc must be a non-empty string");
  const chords = l.chords;
  if (!Array.isArray(chords) || chords.length === 0) {
    fatal.push("chords must be a non-empty array");
  } else {
    chords.forEach((c, idx) => {
      const ch = c as { chord?: unknown; bar?: unknown; beat?: unknown } | null;
      if (!ch || typeof ch.chord !== "string" || !/^[A-G][b#]?/.test(ch.chord)) {
        fatal.push(`chords[${idx}] has no readable root`);
        return;
      }
      if (typeof ch.bar !== "number" || !Number.isInteger(ch.bar) || ch.bar < 1) fatal.push(`chords[${idx}] bar must be a positive integer`);
      if (typeof ch.beat !== "number" || !Number.isFinite(ch.beat) || ch.beat < 1) fatal.push(`chords[${idx}] beat must be a positive number`);
    });
  }
  if (fatal.length > 0) return { fatal, strict };

  const noteList = notes as Array<{ pitch: string; duration: string }>;

  // --- strict: does it fit the grid and agree with itself? ---
  if (l.bars !== expectedBars) strict.push(`bars is ${String(l.bars)}, expected ${expectedBars}`);

  if (beatsPerBar === null) return { fatal, strict };
  const target = expectedBars * beatsPerBar;

  const total = noteList.reduce((sum, n) => sum + DURATION_BEATS[n.duration], 0);
  if (Math.abs(total - target) > EPS) {
    strict.push(`notes last ${fmtBeats(total)} beats; ${expectedBars} bars of ${timeSig} need ${target}`);
  }

  const chordList = chords as Array<{ chord: string; bar: number; beat: number }>;
  chordList.forEach(({ bar, beat }, idx) => {
    if (bar > expectedBars) strict.push(`chords[${idx}] bar ${bar} is outside 1-${expectedBars}`);
    if (beat >= beatsPerBar + 1) strict.push(`chords[${idx}] beat ${beat} is outside the bar`);
  });
  if (!chordList.some(({ bar, beat }) => bar === 1 && beat === 1)) strict.push("no chord at bar 1 beat 1");

  // ABC must encode exactly the notes array, bar by bar.
  const abc = parseAbc(l.abc as string);
  if (abc.errors.length > 0) {
    strict.push(...abc.errors.map((e) => `abc: ${e}`));
    return { fatal, strict };
  }
  if (abc.beatsPerBar !== null && Math.abs(abc.beatsPerBar - beatsPerBar) > EPS) {
    strict.push(`abc meter (${fmtBeats(abc.beatsPerBar)} beats) disagrees with timeSignature ${timeSig}`);
  }
  if (abc.bars.length !== expectedBars) {
    strict.push(`abc has ${abc.bars.length} bars, expected ${expectedBars}`);
  }
  abc.bars.forEach((bar, idx) => {
    const sum = bar.reduce((s, e) => s + e.beats, 0);
    if (Math.abs(sum - beatsPerBar) > EPS) {
      strict.push(`abc bar ${idx + 1} lasts ${fmtBeats(sum)} beats, expected ${fmtBeats(beatsPerBar)}`);
    }
  });
  const events = abc.bars.flat();
  if (events.length !== noteList.length) {
    strict.push(`abc has ${events.length} notes/rests but notes has ${noteList.length}`);
  }
  const n = Math.min(events.length, noteList.length);
  for (let idx = 0; idx < n; idx++) {
    const note = noteList[idx];
    const ev = events[idx];
    const midi = note.pitch === "rest" ? null : pitchMidi(note.pitch);
    const beats = DURATION_BEATS[note.duration];
    if (midi !== ev.midi || Math.abs(beats - ev.beats) > EPS) {
      strict.push(`abc disagrees with notes at index ${idx} (notes: ${note.pitch} ${note.duration})`);
      break; // later indices are usually shifted by the same mistake
    }
  }

  return { fatal, strict };
}

/** One-line summary for logs and thrown errors. */
export function describeIssues(issues: LickIssues): string {
  return [...issues.fatal, ...issues.strict].slice(0, 5).join("; ");
}
