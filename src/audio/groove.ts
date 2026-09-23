// Pure pattern logic for the synthesized drum + bass backing groove.
//
// Everything here is deterministic data: no Tone.js, no randomness. Patterns are
// expressed on a 16th-note step grid measured from the top of the lick (step 0 =
// bar 1 beat 1). usePlayback turns steps into transport time strings with
// stepToTransportTime() so the transport's swing / swingSubdivision applies to
// the groove exactly as it does to the lick.
//
// All patterns are original. Grids read "1 e & a 2 e & a 3 e & a 4 e & a".

import type { Chord, Genre } from "../types/lick";
import { chordRootPc, chordToneIntervals } from "../utils/chords";

export type GrooveStyle = "pocket" | "backbeat" | "swing";

export const GROOVE_STYLES: { value: GrooveStyle; label: string; hint: string }[] = [
  { value: "pocket", label: "Pocket", hint: "Neo-soul 16ths: lazy kick, ghost snares, breathing bass" },
  { value: "backbeat", label: "Backbeat", hint: "Classic soul: straight 8ths, big 2 & 4" },
  { value: "swing", label: "Swing", hint: "Light jazz ride, feathered kick, two-feel bass" },
];

/**
 * Swing subdivision each style is written for. Pocket's syncopation lives on the
 * 16ths, so it wants transport.swingSubdivision = "16n"; the others swing 8ths.
 */
export const GROOVE_SWING_SUBDIVISION: Record<GrooveStyle, "8n" | "16n"> = {
  pocket: "16n",
  backbeat: "8n",
  swing: "8n",
};

/** "ride" is used by the swing style only (the other voices are shared). */
export type DrumVoice = "kick" | "snare" | "ghost" | "hat" | "openHat" | "rim" | "ride";

/** step = absolute 16th from the top of the lick. */
export interface DrumHit { step: number; voice: DrumVoice; velocity: number }

export type BassRole = "root" | "fifth" | "octave" | "seventh" | "approach";

/** pitch uses flats only (e.g. "Bb1", "Gb2"), always parseable by Tone. */
export interface BassHit { step: number; lengthSteps: number; pitch: string; velocity: number; role: BassRole }

export function defaultGrooveStyle(genre: Genre): GrooveStyle {
  switch (genre) {
    case "jazz": return "swing";
    case "rnb":
    case "funk": return "pocket";
    case "blues":
    case "bossa": return "backbeat";
  }
}

export function stepToTransportTime(step: number, beatsPerBar: number): string {
  const perBar = beatsPerBar * 4;
  const bars = Math.floor(step / perBar);
  const rem = step - bars * perBar;
  return `${bars}:${Math.floor(rem / 4)}:${rem % 4}`;
}

// ---------------------------------------------------------------------------
// Drums
// ---------------------------------------------------------------------------

// Grid characters -> velocity. '.' = rest.
const VEL: Record<string, number> = { X: 0.95, x: 0.75, o: 0.5, g: 0.28, f: 0.2 };

type Grid = Partial<Record<DrumVoice, string>>;
interface StyleGrids { a: Grid; b: Grid; fill: Grid }

// 4/4 grids (16 steps). Bar A = odd bars, bar B = even bars, fill = last bar
// of a 2+ bar loop so the loop breathes on the way back to the top.
const GRIDS_16: Record<GrooveStyle, StyleGrids> = {
  pocket: {
    a: {
      kick:    "X......x..x.....",
      snare:   "....X.......X...",
      ghost:   "......g....g...g",
      hat:     "x.ogx.ogx.ogx...",
      openHat: "..............o.", // choked by the next downbeat's closed hat
    },
    b: {
      kick:    "X......x..x....o",
      snare:   "....X.......X...",
      ghost:   "......g..g...g..",
      hat:     "x.ogx...x.ogx.og",
      openHat: "......o.........",
    },
    fill: {
      kick:    "X......x..x.....",
      snare:   "....X.......X.o.",
      ghost:   "......g....g.g.g",
      hat:     "x.ogx.ogx.ogx...",
    },
  },
  backbeat: {
    a: {
      kick:    "X.....o.X.......",
      snare:   "....X.......X...",
      hat:     "x.o.x.o.x.o.x.o.",
    },
    b: {
      kick:    "X.....o.X.x.....",
      snare:   "....X.......X...",
      hat:     "x.o.x.o.x.o.x...",
      openHat: "..............o.", // tambourine-ish lift into the next bar
    },
    fill: {
      kick:    "X.....o.X.......",
      snare:   "....X.......X.ox",
      hat:     "x.o.x.o.x.o.x...",
    },
  },
  swing: {
    a: {
      ride:    "o...x.g.o...x.g.",
      hat:     "....g.......g...", // hi-hat foot on 2 & 4
      kick:    "f...f...f...f...", // feathered
    },
    b: {
      ride:    "o...x.g.o...x.g.",
      hat:     "....g.......g...",
      kick:    "f...f...f...f...",
      rim:     "............o...",
    },
    fill: {
      ride:    "o...x.g.o...x...",
      hat:     "....g.......g...",
      kick:    "f...f...f...f...",
      ghost:   "..........g...g.",
      rim:     "......o.........",
    },
  },
};

// 3/4 grids (12 steps): R&B 3/4 puts the backbeat on 3; jazz waltz rides 1, 2, 2&, 3.
const GRIDS_12: Record<GrooveStyle, StyleGrids> = {
  pocket: {
    a:    { kick: "X......x....", snare: "........X...", ghost: "....g......g", hat: "x.ogx.ogx.og" },
    b:    { kick: "X.....o..x..", snare: "........X...", ghost: "...g.......g", hat: "x.ogx...x.og", openHat: "......o....." },
    fill: { kick: "X......x....", snare: "........X.o.", ghost: "....g....g.g", hat: "x.ogx.ogx..." },
  },
  backbeat: {
    a:    { kick: "X.......o...", snare: "....X...X...", hat: "x.o.x.o.x.o." },
    b:    { kick: "X.....o.o...", snare: "....X...X...", hat: "x.o.x.o.x...", openHat: "..........o." },
    fill: { kick: "X.......o...", snare: "....X...X.ox", hat: "x.o.x.o.x..." },
  },
  swing: {
    a:    { ride: "o...x.g.x...", hat: "....g...g...", kick: "f..........." },
    b:    { ride: "o...x.g.x...", hat: "....g...g...", kick: "f...........", rim: "........o..." },
    fill: { ride: "o...x.g.x...", hat: "....g...g...", kick: "f...........", ghost: "......g...g." },
  },
};

// Stable voice order so simultaneous hits come out in a predictable order
// (closed hat before open hat so a same-step choke never cuts the new open hat).
const VOICE_ORDER: DrumVoice[] = ["kick", "snare", "ghost", "rim", "hat", "openHat", "ride"];

function gridsFor(style: GrooveStyle, stepsPerBar: number): StyleGrids {
  return stepsPerBar === 12 ? GRIDS_12[style] : GRIDS_16[style];
}

/** Grid character for a step in a bar; other meters tile the 4/4 grid. */
function gridChar(grid: string, pos: number): string {
  return grid[pos % grid.length];
}

export function buildDrumPattern(style: GrooveStyle, bars: number, beatsPerBar: number): DrumHit[] {
  const stepsPerBar = beatsPerBar * 4;
  if (bars <= 0 || stepsPerBar <= 0) return [];
  const grids = gridsFor(style, stepsPerBar);
  const hits: DrumHit[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const grid = bars >= 2 && bar === bars - 1 ? grids.fill : bar % 2 === 0 ? grids.a : grids.b;
    for (let pos = 0; pos < stepsPerBar; pos++) {
      for (const voice of VOICE_ORDER) {
        const row = grid[voice];
        if (!row) continue;
        const v = VEL[gridChar(row, pos)];
        if (v !== undefined) hits.push({ step: bar * stepsPerBar + pos, voice, velocity: v });
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Bass
// ---------------------------------------------------------------------------

const BASS_LOW = 28;  // E1
const BASS_HIGH = 43; // G2
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function midiToPitch(midi: number): string {
  return `${FLAT_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

interface BassSlot { pos: number; role: Exclude<BassRole, "approach">; len: number; vel: number }
interface BassStyle {
  slots16: BassSlot[];
  slots12: BassSlot[];
  /** How many 16ths before a chord change the approach note sits. */
  approachLead: number;
  approachLen: number;
  /** Length of the chord-change root when it lands off the template grid. */
  offGridRootLen: number;
}

const BASS_STYLES: Record<GrooveStyle, BassStyle> = {
  // Locks with the pocket kick (1, a-of-2, &-of-3) and leaves beat 4 open.
  pocket: {
    slots16: [
      { pos: 0, role: "root", len: 5, vel: 0.92 },
      { pos: 7, role: "octave", len: 2, vel: 0.7 },
      { pos: 10, role: "fifth", len: 3, vel: 0.8 },
      { pos: 13, role: "seventh", len: 1, vel: 0.3 }, // ghosted b7/6
    ],
    slots12: [
      { pos: 0, role: "root", len: 5, vel: 0.92 },
      { pos: 7, role: "octave", len: 2, vel: 0.7 },
      { pos: 9, role: "fifth", len: 1, vel: 0.3 },
    ],
    approachLead: 1,
    approachLen: 1,
    offGridRootLen: 3,
  },
  // Straight-8th Motown-ish line: root, octave pickup on the &-of-2, 5th on 3, root on 4.
  backbeat: {
    slots16: [
      { pos: 0, role: "root", len: 3, vel: 0.9 },
      { pos: 6, role: "octave", len: 2, vel: 0.68 },
      { pos: 8, role: "fifth", len: 3, vel: 0.85 },
      { pos: 12, role: "root", len: 2, vel: 0.75 },
    ],
    slots12: [
      { pos: 0, role: "root", len: 3, vel: 0.9 },
      { pos: 4, role: "fifth", len: 2, vel: 0.72 },
      { pos: 8, role: "octave", len: 2, vel: 0.75 },
    ],
    approachLead: 2,
    approachLen: 1,
    offGridRootLen: 2,
  },
  // Jazz two-feel: half notes (root, 5th) with a swung-8th approach on the &-of-4.
  swing: {
    slots16: [
      { pos: 0, role: "root", len: 7, vel: 0.85 },
      { pos: 8, role: "fifth", len: 5, vel: 0.75 },
    ],
    slots12: [
      { pos: 0, role: "root", len: 7, vel: 0.85 },
      { pos: 8, role: "fifth", len: 2, vel: 0.6 },
    ],
    approachLead: 2,
    approachLen: 2,
    offGridRootLen: 4,
  },
};

/** Minimum gap (in 16ths) between a bass hit and the next template slot. */
const MIN_GAP = 2;

interface Change { step: number; chord: string; rootPc: number | null }

function chordChanges(chords: Chord[], totalSteps: number, beatsPerBar: number): Change[] {
  const byStep = new Map<number, Change>();
  for (const c of chords) {
    const step = Math.round(((c.bar - 1) * beatsPerBar + (c.beat - 1)) * 4);
    if (!Number.isFinite(step) || step < 0 || step >= totalSteps) continue;
    byStep.set(step, { step, chord: c.chord, rootPc: chordRootPc(c.chord) }); // later duplicate wins
  }
  return [...byStep.values()].sort((a, b) => a.step - b.step);
}

/** Place a root pitch class in register, nearest the previous root (smooth line). */
function placeRoot(pc: number, prev: number | null): number {
  const lowest = BASS_LOW + ((pc - BASS_LOW) % 12 + 12) % 12; // 28..39
  if (prev === null) return lowest;
  const candidates = [lowest, lowest + 12].filter((m) => m <= BASS_HIGH);
  return candidates.reduce((best, m) => (Math.abs(m - prev) < Math.abs(best - prev) ? m : best));
}

function inRange(m: number): boolean {
  return m >= BASS_LOW && m <= BASS_HIGH;
}

/**
 * Pitch for a template role. The register is narrow (E1..G2), so each role has
 * a preference-ordered list of chord-tone placements; the first in range that
 * differs from the previous note wins, keeping the line moving.
 */
function rolePitch(role: Exclude<BassRole, "approach">, root: number, chord: string, prev: number): number {
  if (role === "root") return root;
  const tones = chordToneIntervals(chord);
  const fifth = tones[2] ?? 7;
  // Triads get a 6th on major-ish chords and a b7 on minor ones.
  const seventh = tones[3] ?? (tones[1] === 3 ? 10 : 9);
  const candidates =
    role === "octave" ? [root + 12, root - 12, root + fifth - 12, root + seventh - 12, root + fifth]
    : role === "fifth" ? [root + fifth, root + fifth - 12, root + seventh - 12, root + 12, root - 12]
    : [root + seventh, root + seventh - 12, root + fifth - 12, root + fifth];
  return candidates.find((m) => inRange(m) && m !== prev) ?? root;
}

function approachPitch(style: GrooveStyle, target: number, segIndex: number, prevPitch: number): number {
  // Pocket and swing lean chromatic; backbeat alternates a whole step below
  // with a half step above. Direction follows where the line currently sits.
  const fromBelow = style === "backbeat" ? segIndex % 2 === 0 : prevPitch <= target;
  const dist = style === "backbeat" && fromBelow ? 2 : 1;
  const first = fromBelow ? target - dist : target + dist;
  if (inRange(first)) return first;
  const other = fromBelow ? target + dist : target - dist;
  return inRange(other) ? other : target;
}

export function buildBassLine(style: GrooveStyle, chords: Chord[], bars: number, beatsPerBar: number): BassHit[] {
  const stepsPerBar = beatsPerBar * 4;
  const totalSteps = bars * stepsPerBar;
  if (totalSteps <= 0) return [];
  const changes = chordChanges(chords, totalSteps, beatsPerBar);
  if (changes.length === 0) return [];

  const cfg = BASS_STYLES[style];
  const template = stepsPerBar === 12 ? cfg.slots12 : cfg.slots16;
  const slotAt = new Map<number, BassSlot>();
  for (const s of template) slotAt.set(s.pos, s);
  // Template position of an absolute step; meters other than 3/4 and 4/4 tile the 4/4 template.
  const posKey = (step: number) => (step % stepsPerBar) % 16;

  // Place every root first so approach notes know their target.
  const roots: (number | null)[] = [];
  let prevRoot: number | null = null;
  for (const ch of changes) {
    if (ch.rootPc === null) { roots.push(null); continue; }
    prevRoot = placeRoot(ch.rootPc, prevRoot);
    roots.push(prevRoot);
  }

  const hits: BassHit[] = [];
  changes.forEach((ch, i) => {
    const root = roots[i];
    if (root === null) return; // "N.C." etc: the bass lays out
    const start = ch.step;
    const end = i + 1 < changes.length ? changes[i + 1].step : totalSteps;
    // Wrap to the first chord when the last segment runs into the loop point.
    const nextIdx = i + 1 < changes.length ? i + 1 : 0;
    const nextRoot = roots[nextIdx];
    const approachStep = nextRoot !== null && end - cfg.approachLead - start >= MIN_GAP
      ? end - cfg.approachLead
      : null;
    const limit = approachStep ?? end;

    const seg: Omit<BassHit, "lengthSteps">[] = [];
    const lens: number[] = [];
    const startSlot = slotAt.get(posKey(start));
    seg.push({ step: start, pitch: midiToPitch(root), velocity: startSlot?.vel ?? 0.88, role: "root" });
    lens.push(startSlot?.len ?? cfg.offGridRootLen);

    let last = start;
    let lastPitch = root;
    for (let s = start + 1; s < limit; s++) {
      const slot = slotAt.get(posKey(s));
      if (!slot || s - last < MIN_GAP) continue;
      const pitch = rolePitch(slot.role, root, ch.chord, lastPitch);
      seg.push({ step: s, pitch: midiToPitch(pitch), velocity: slot.vel, role: slot.role });
      lens.push(slot.len);
      last = s;
      lastPitch = pitch;
    }
    if (approachStep !== null && nextRoot !== null) {
      const p = approachPitch(style, nextRoot, i, lastPitch);
      seg.push({ step: approachStep, pitch: midiToPitch(p), velocity: 0.62, role: "approach" });
      lens.push(cfg.approachLen);
    }

    seg.forEach((h, j) => {
      const nextStep = j + 1 < seg.length ? seg[j + 1].step : end;
      hits.push({ ...h, lengthSteps: Math.max(1, Math.min(lens[j], nextStep - h.step)) });
    });
  });
  return hits;
}
