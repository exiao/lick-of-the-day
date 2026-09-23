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
//            rejects these and regenerates; user-facing paths log them.

import { meterBeats, parseAbc } from "./abc";

export interface LickIssues {
  fatal: string[];
  strict: string[];
}

// Mirrors durationToBeats in src/utils/music.ts; anything else silently plays
// as an 8th on the client and shifts every later note off the grid.
const DURATION_BEATS: Record<string, number> = {
  "1n": 4, "2n.": 3, "2n": 2, "4n.": 1.5, "4n": 1,
  "8n.": 0.75, "8n": 0.5, "16n.": 0.375, "16n": 0.25, "32n": 0.125,
};

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
  if (!lick || typeof lick !== "object") return { fatal: ["lick is not an object"], strict };
  const l = lick as Record<string, unknown>;

  // --- fatal: can it play and render at all? ---
  const notes = l.notes;
  if (!Array.isArray(notes) || notes.length === 0) {
    fatal.push("notes must be a non-empty array");
  } else {
    notes.forEach((n, idx) => {
      const note = n as { pitch?: unknown; duration?: unknown } | null;
      if (!note || typeof note.pitch !== "string" || typeof note.duration !== "string") {
        fatal.push(`notes[${idx}] needs string pitch and duration`);
        return;
      }
      if (note.pitch !== "rest" && pitchMidi(note.pitch) === null) {
        fatal.push(`notes[${idx}] has unplayable pitch "${note.pitch}"`);
      }
      if (!(note.duration in DURATION_BEATS)) {
        fatal.push(`notes[${idx}] has unknown duration "${note.duration}"`);
      }
    });
  }
  if (typeof l.abc !== "string" || l.abc.trim() === "") fatal.push("abc must be a non-empty string");
  if (fatal.length > 0) return { fatal, strict };

  const noteList = notes as Array<{ pitch: string; duration: string }>;

  // --- strict: does it fit the grid and agree with itself? ---
  if (l.bars !== expectedBars) strict.push(`bars is ${String(l.bars)}, expected ${expectedBars}`);

  const timeSig = typeof l.timeSignature === "string" ? l.timeSignature : "4/4";
  const beatsPerBar = meterBeats(timeSig);
  if (beatsPerBar === null) {
    strict.push(`unreadable timeSignature "${timeSig}"`);
    return { fatal, strict };
  }
  const target = expectedBars * beatsPerBar;

  const total = noteList.reduce((sum, n) => sum + DURATION_BEATS[n.duration], 0);
  if (Math.abs(total - target) > EPS) {
    strict.push(`notes last ${fmtBeats(total)} beats; ${expectedBars} bars of ${timeSig} need ${target}`);
  }

  // Scientific spellings that cross the octave boundary (Cb4 = B3, B#3 = C4)
  // are read an octave off by the client's parsePitch.
  noteList.forEach((n, idx) => {
    if (/^(Cb|B#)\d$/.test(n.pitch)) strict.push(`notes[${idx}] "${n.pitch}" is misread by the player; respell it`);
  });

  // Chord chart drives the backing track and the chord-tone display.
  const chords = l.chords;
  if (!Array.isArray(chords) || chords.length === 0) {
    strict.push("chords must be a non-empty array");
  } else {
    let hasDownbeat = false;
    chords.forEach((c, idx) => {
      const ch = c as { chord?: unknown; bar?: unknown; beat?: unknown } | null;
      if (!ch || typeof ch.chord !== "string" || !/^[A-G][b#]?/.test(ch.chord)) {
        strict.push(`chords[${idx}] has no readable root`);
        return;
      }
      const bar = ch.bar, beat = ch.beat;
      if (typeof bar !== "number" || !Number.isInteger(bar) || bar < 1 || bar > expectedBars) {
        strict.push(`chords[${idx}] bar ${String(bar)} is outside 1-${expectedBars}`);
      }
      if (typeof beat !== "number" || beat < 1 || beat >= beatsPerBar + 1) {
        strict.push(`chords[${idx}] beat ${String(beat)} is outside the bar`);
      }
      if (bar === 1 && beat === 1) hasDownbeat = true;
    });
    if (!hasDownbeat) strict.push("no chord at bar 1 beat 1");
  }

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
