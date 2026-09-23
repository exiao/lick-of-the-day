import { it, expect } from "vitest";
import abcjs from "abcjs";
import type { Lick } from "../types/lick";

// Validates that each hand-written lick's ABC notation, notes array and chord
// chart describe the same music. abcjs.parseOnly runs fine in the node env.

const LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DIATONIC = [0, 2, 4, 5, 7, 9, 11];
const ACC_OFFSET: Record<string, number> = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2 };
const TONE_BEATS: Record<string, number> = {
  "16n": 0.25, "8n": 0.5, "8n.": 0.75, "4n": 1, "4n.": 1.5, "2n": 2, "2n.": 3, "1n": 4,
};

type Event = { midi: number | null; beats: number; onset: number };

export function noteToMidi(pitch: string): number {
  const m = /^([A-G])([#b]*)(-?\d)$/.exec(pitch);
  if (!m) throw new Error(`bad pitch ${pitch}`);
  const acc = [...m[2]].reduce((s, c) => s + (c === "#" ? 1 : -1), 0);
  return 12 * (Number(m[3]) + 1) + LETTER_SEMITONES[m[1]] + acc;
}

export function beatsOf(duration: string): number {
  const b = TONE_BEATS[duration];
  if (b === undefined) throw new Error(`unknown duration ${duration}`);
  return b;
}

/** Walk the parsed ABC tune: pitched/rest events (in quarter beats) and chord annotations. */
export function parseAbc(abc: string) {
  const tune = abcjs.parseOnly(abc)[0];
  // Key signature accidentals, e.g. { B: -1 } for K:F.
  const keyAcc: Record<string, number> = {};
  for (const a of tune.getKeySignature().accidentals ?? []) keyAcc[a.note.toUpperCase()] = ACC_OFFSET[a.acc];

  const events: Event[] = [];
  const chords: { chord: string; onset: number }[] = [];
  const barLines: number[] = []; // onset of each bar line, in quarter beats
  let pos = 0;
  let barAcc: Record<number, number> = {}; // diatonic step -> offset, reset at each bar line
  for (const line of tune.lines) {
    for (const staff of line.staff ?? []) {
      for (const voice of staff.voices ?? []) {
        // abcjs's VoiceItem union is awkward to narrow; read the fields we need loosely.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const el of voice as any[]) {
          if (el.el_type === "bar") {
            barAcc = {};
            if (pos > 0) barLines.push(pos); // a leading "|:" repeat sign isn't a measure end
          }
          if (el.el_type !== "note") continue;
          // abcjs renders "b"/"#" in chord names as ♭/♯; normalise back.
          for (const c of el.chord ?? []) chords.push({ chord: c.name.replace(/♭/g, "b").replace(/♯/g, "#"), onset: pos });
          const beats = el.duration * 4;
          if (el.rest) {
            events.push({ midi: null, beats, onset: pos });
          } else {
            const p = el.pitches[0];
            if (p.accidental) barAcc[p.pitch] = ACC_OFFSET[p.accidental];
            const step = ((p.pitch % 7) + 7) % 7;
            const octave = Math.floor(p.pitch / 7);
            const letter = "CDEFGAB"[step];
            const acc = barAcc[p.pitch] ?? keyAcc[letter] ?? 0;
            events.push({ midi: 60 + 12 * octave + DIATONIC[step] + acc, beats, onset: pos });
          }
          pos += beats;
        }
      }
    }
  }
  return { events, chords, barLines };
}

const CHORD_INTERVALS: [RegExp, number[]][] = [
  [/^(maj|M7|M9|Δ)/, [0, 4, 7, 11]],
  [/^(m7b5|ø)/, [0, 3, 6, 10]],
  [/^dim7?/, [0, 3, 6, 9]],
  [/^(m7|m9|m11)/, [0, 3, 7, 10]],
  [/^m6/, [0, 3, 7, 9]],
  [/^m/, [0, 3, 7]],
  [/^6/, [0, 4, 7, 9]],
  [/^(7|9|13)/, [0, 4, 7, 10]],
  [/^/, [0, 4, 7]],
];

function chordToneClasses(symbol: string): number[] {
  const m = /^([A-G])([#b]?)(.*)$/.exec(symbol);
  if (!m) throw new Error(`bad chord ${symbol}`);
  const root = LETTER_SEMITONES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const intervals = CHORD_INTERVALS.find(([re]) => re.test(m[3]))![1];
  return intervals.map((i) => (root + i + 12) % 12);
}

const describePos = (onset: number, bpb: number) =>
  `bar ${Math.floor(onset / bpb) + 1}, beat ${(onset % bpb) + 1}`;

export function checkLick(lick: Lick, opts: { rangeCheck: boolean; finalChordTone: boolean }) {
  const bpb = Number(lick.timeSignature.split("/")[0]) * (4 / Number(lick.timeSignature.split("/")[1]));
  const { events, chords, barLines } = parseAbc(lick.abc);

  it("note durations fill exactly bars * beatsPerBar", () => {
    const total = lick.notes.reduce((s, n) => s + beatsOf(n.duration), 0);
    expect(total).toBe(lick.bars * bpb);
  });

  it("ABC has exactly `bars` measures, each a full bar long", () => {
    expect(barLines).toEqual(Array.from({ length: lick.bars }, (_, i) => (i + 1) * bpb));
  });

  it("no note crosses a bar line (there are no ties)", () => {
    let onset = 0;
    const crossing: string[] = [];
    for (const n of lick.notes) {
      const end = onset + beatsOf(n.duration);
      if (Math.floor(onset / bpb) !== Math.floor((end - 1e-9) / bpb)) crossing.push(`${n.pitch} at ${describePos(onset, bpb)}`);
      onset = end;
    }
    expect(crossing).toEqual([]);
  });

  it("ABC notes match the notes array one-to-one (pitch + duration)", () => {
    const expected = lick.notes.map((n) => ({
      midi: n.pitch === "rest" ? null : noteToMidi(n.pitch),
      beats: beatsOf(n.duration),
    }));
    const actual = events.map(({ midi, beats }) => ({ midi, beats }));
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
      const where = actual[i] ? describePos(events[i].onset, bpb) : "past end of ABC";
      expect(actual[i], `note index ${i} (${lick.notes[i]?.pitch}) at ${where}`).toEqual(expected[i]);
    }
  });

  it("chord symbols appear in the ABC at the same bar/beat", () => {
    const fromAbc = chords.map((c) => ({
      chord: c.chord,
      bar: Math.floor(c.onset / bpb) + 1,
      beat: (c.onset % bpb) + 1,
    }));
    expect(fromAbc).toEqual(lick.chords.map(({ chord, bar, beat }) => ({ chord, bar, beat })));
  });

  if (opts.rangeCheck) {
    it("pitched notes stay within C4..E5", () => {
      const out = lick.notes.filter((n) => n.pitch !== "rest" && (noteToMidi(n.pitch) < 60 || noteToMidi(n.pitch) > 76));
      expect(out.map((n) => n.pitch)).toEqual([]);
    });
  }

  (opts.finalChordTone ? it : it.skip)("final pitched note is a chord tone of the active chord", () => {
    let onset = 0;
    let last: { pitch: string; onset: number } | null = null;
    for (const n of lick.notes) {
      if (n.pitch !== "rest") last = { pitch: n.pitch, onset };
      onset += beatsOf(n.duration);
    }
    expect(last).not.toBeNull();
    const active = [...lick.chords]
      .filter((c) => (c.bar - 1) * bpb + (c.beat - 1) <= last!.onset)
      .pop()!;
    const pc = noteToMidi(last!.pitch) % 12;
    expect(chordToneClasses(active.chord), `${last!.pitch} over ${active.chord}`).toContain(pc);
  });
}
