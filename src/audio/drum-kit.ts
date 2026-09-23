// Synthesized drum kit + R&B synth bass for the backing groove.
//
// No samples: every voice is built from Tone.js oscillators, one shared
// free-running white-noise source and envelopes. Tone is taken as a parameter
// (types-only import) so this module never pulls Tone into the main bundle;
// callers pass the lazily loaded namespace from getTone().
//
// Signal flow
//   drums: voices -> bus in -> highpass 30 Hz -> compressor -> bus out (-12 dB) -> destination
//   bass:  square MonoSynth (filter-envelope pluck) + sine body -> lowpass 900 Hz
//          -> compressor -> out (-8 dB) -> destination
//
// All nodes are created once in the factory; trigger() only schedules envelopes
// on existing nodes (no per-hit allocation) and dispose() tears everything down.

import type * as Tone from "tone";
import type { DrumVoice } from "./groove";

type ToneNS = typeof Tone;

export interface DrumKit {
  trigger(voice: DrumVoice, time: number, velocity: number): void;
  dispose(): void;
}

export interface GrooveBass {
  trigger(pitch: string, durationSec: number, time: number, velocity: number): void;
  dispose(): void;
}

export interface GrooveOutputOptions {
  /** Output level of the bus in dB (drums default -12, bass default -8). */
  volumeDb?: number;
}

// Tone sources/monophonic synths assert that a restart is strictly later than
// the previous start. Nudge same-instant retriggers by a hair instead of throwing.
const EPS = 0.0005;

class MonotonicClock {
  private last = -Infinity;
  next(time: number): number {
    const t = time <= this.last ? this.last + EPS : time;
    this.last = t;
    return t;
  }
}

const KICK_HZ = 50;
const SNARE_BODY_HZ = 190;
const RIM_HZ = 1650;
const RIDE_HZ = 340;
const OPEN_HAT_DECAY = 0.32;

export function createDrumKit(T: ToneNS, destination: Tone.InputNode, opts: GrooveOutputOptions = {}): DrumKit {
  const nodes: { dispose(): unknown }[] = [];
  const own = <N extends { dispose(): unknown }>(n: N): N => { nodes.push(n); return n; };

  // --- Bus -------------------------------------------------------------------
  const out = own(new T.Gain(T.dbToGain(opts.volumeDb ?? -12)));
  out.connect(destination);
  const comp = own(new T.Compressor({ threshold: -18, ratio: 3, attack: 0.004, release: 0.12, knee: 6 }));
  const busHp = own(new T.Filter({ type: "highpass", frequency: 30, rolloff: -12 }));
  const bus = own(new T.Gain(1));
  bus.chain(busHp, comp, out);

  const level = (db: number) => {
    const g = own(new T.Gain(T.dbToGain(db)));
    g.connect(bus);
    return g;
  };

  // --- Shared noise source ---------------------------------------------------
  // One always-running white noise feeds every noisy voice through its own
  // filter + envelope, so hits never start/stop a buffer source.
  const noise = own(new T.Noise("white"));
  let noiseStarted = false;
  const ensureNoise = () => {
    if (!noiseStarted) { noise.start(); noiseStarted = true; }
  };

  const noiseVoice = (filter: Tone.Filter, env: Partial<Tone.EnvelopeOptions>, db: number) => {
    const e = own(new T.AmplitudeEnvelope({ attack: 0.001, sustain: 0, ...env }));
    filter.connect(e);
    e.connect(level(db));
    return e;
  };

  // --- Kick: fast pitch-drop membrane + tiny noise click for the beater --------
  const kick = own(new T.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.05 },
  }));
  kick.connect(level(0));
  const clickHp = own(new T.Filter({ type: "highpass", frequency: 3200, rolloff: -12 }));
  noise.connect(clickHp);
  const clickEnv = noiseVoice(clickHp, { decay: 0.008, release: 0.005 }, -14);

  // --- Snare: band-limited noise crack + short tonal body ----------------------
  const snareHp = own(new T.Filter({ type: "highpass", frequency: 1100, rolloff: -12 }));
  const snareLp = own(new T.Filter({ type: "lowpass", frequency: 9500, rolloff: -12 }));
  noise.chain(snareHp, snareLp);
  const snareEnv = noiseVoice(snareLp, { decay: 0.17, release: 0.06 }, -5);
  const ghostEnv = noiseVoice(snareLp, { decay: 0.065, release: 0.03 }, -7);
  const snareBody = own(new T.MembraneSynth({
    pitchDecay: 0.015,
    octaves: 1.6,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.03 },
  }));
  snareBody.connect(level(-9));

  // --- Hats: highpassed noise, closed chokes open ------------------------------
  const hatHp = own(new T.Filter({ type: "highpass", frequency: 8200, rolloff: -24 }));
  noise.connect(hatHp);
  const hatEnv = noiseVoice(hatHp, { decay: 0.04, release: 0.01 }, -11);
  const openEnv = noiseVoice(hatHp, { attack: 0.002, decay: OPEN_HAT_DECAY, release: 0.035 }, -13);
  let openRingsUntil = -Infinity;

  // --- Rim (cross-stick): short high woody click --------------------------------
  const rimBp = own(new T.Filter({ type: "bandpass", frequency: RIM_HZ, Q: 2.5 }));
  const rim = own(new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.0005, decay: 0.028, sustain: 0, release: 0.01 },
  }));
  rim.connect(rimBp);
  rimBp.connect(level(-8));

  // --- Ride (swing style): inharmonic metal "ting" with a short wash ------------
  const ride = own(new T.MetalSynth({
    harmonicity: 5.1,
    modulationIndex: 20,
    resonance: 5200,
    octaves: 1.1,
    envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.2 },
  }));
  ride.connect(level(-20));

  const clocks: Record<DrumVoice, MonotonicClock> = {
    kick: new MonotonicClock(), snare: new MonotonicClock(), ghost: new MonotonicClock(),
    hat: new MonotonicClock(), openHat: new MonotonicClock(), rim: new MonotonicClock(),
    ride: new MonotonicClock(),
  };

  let disposed = false;

  return {
    trigger(voice, time, velocity) {
      if (disposed) return;
      ensureNoise();
      const t = clocks[voice].next(time);
      const v = Math.max(0, Math.min(1, velocity));
      switch (voice) {
        case "kick":
          kick.triggerAttackRelease(KICK_HZ, 0.12, t, v);
          clickEnv.triggerAttack(t, v);
          break;
        case "snare":
          snareEnv.triggerAttack(t, v);
          snareBody.triggerAttackRelease(SNARE_BODY_HZ, 0.05, t, v);
          break;
        case "ghost":
          ghostEnv.triggerAttack(t, v);
          break;
        case "hat":
          // Choke a still-ringing open hat (only if it is actually ringing).
          if (t > openRingsUntil - OPEN_HAT_DECAY && t < openRingsUntil) {
            openEnv.triggerRelease(t);
            openRingsUntil = t;
          }
          hatEnv.triggerAttack(t, v);
          break;
        case "openHat":
          openEnv.triggerAttack(t, v);
          openRingsUntil = t + OPEN_HAT_DECAY;
          break;
        case "rim":
          rim.triggerAttackRelease(RIM_HZ, 0.02, t, v);
          break;
        case "ride":
          ride.triggerAttackRelease(RIDE_HZ, 0.05, t, v);
          break;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (noiseStarted) noise.stop();
      for (const n of nodes) n.dispose();
      nodes.length = 0;
    },
  };
}

export function createGrooveBass(T: ToneNS, destination: Tone.InputNode, opts: GrooveOutputOptions = {}): GrooveBass {
  const nodes: { dispose(): unknown }[] = [];
  const own = <N extends { dispose(): unknown }>(n: N): N => { nodes.push(n); return n; };

  const out = own(new T.Gain(T.dbToGain(opts.volumeDb ?? -8)));
  out.connect(destination);
  const comp = own(new T.Compressor({ threshold: -16, ratio: 3, attack: 0.006, release: 0.15, knee: 8 }));
  const tone = own(new T.Filter({ type: "lowpass", frequency: 900, rolloff: -12, Q: 0.5 }));
  tone.chain(comp, out);

  // Growl layer: filtered square with a quick filter-envelope pluck.
  const pluck = own(new T.MonoSynth({
    oscillator: { type: "square" },
    filter: { type: "lowpass", rolloff: -24, Q: 1.2 },
    envelope: { attack: 0.004, decay: 0.25, sustain: 0.65, release: 0.07 },
    filterEnvelope: {
      attack: 0.002, decay: 0.14, sustain: 0.3, release: 0.1,
      baseFrequency: 140, octaves: 2.6, exponent: 2,
    },
  }));
  pluck.connect(own(new T.Gain(T.dbToGain(-9))).connect(tone));

  // Round body: pure sine at pitch for weight on small speakers' fundamental.
  const body = own(new T.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.8, release: 0.08 },
  }));
  body.connect(tone);

  // Pitch strings -> Hz, cached so steady-state triggers don't re-parse.
  const hz = new Map<string, number>();
  const toHz = (pitch: string): number => {
    let f = hz.get(pitch);
    if (f === undefined) {
      f = T.Frequency(pitch).toFrequency();
      hz.set(pitch, f);
    }
    return f;
  };

  const clock = new MonotonicClock();
  let disposed = false;

  return {
    trigger(pitch, durationSec, time, velocity) {
      if (disposed) return;
      const t = clock.next(time);
      const f = toHz(pitch);
      const v = Math.max(0, Math.min(1, velocity));
      // Monophonic: a new note simply retriggers, so overlapping calls stay legato-safe.
      const d = Math.max(0.03, durationSec);
      pluck.triggerAttackRelease(f, d, t, v);
      body.triggerAttackRelease(f, d, t, v);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const n of nodes) n.dispose();
      nodes.length = 0;
    },
  };
}
