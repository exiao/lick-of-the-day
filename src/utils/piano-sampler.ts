// Shared piano audio infrastructure: a self-hosted Salamander Grand sampler plus
// a gentle master chain (small room reverb + brickwall limiter) so melody and
// chord backing never clip when played together.
//
// Everything here is a lazily-created app-level singleton. Nodes are created on
// the first user gesture (after the AudioContext is running) and live for the
// page lifetime — they are deliberately NOT disposed on component unmount, since
// they are shared infrastructure and re-creating the sampler would re-download
// ~1.9 MB of samples.

import * as Tone from "tone";

// Salamander subset: one sample every 3 semitones (C, D#, F#, A) across the
// piano range. Tone.Sampler pitch-shifts the nearest sample to fill the gaps.
// Files are self-hosted under public/samples/salamander/ (see PR notes for size).
const SAMPLE_BASE_URL = "/samples/salamander/";
const SAMPLE_URLS: Record<string, string> = {
  C1: "C1.mp3",  "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", A1: "A1.mp3",
  C2: "C2.mp3",  "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3",
  C3: "C3.mp3",  "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", A3: "A3.mp3",
  C4: "C4.mp3",  "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", A4: "A4.mp3",
  C5: "C5.mp3",  "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", A5: "A5.mp3",
  C6: "C6.mp3",  "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", A6: "A6.mp3",
  C7: "C7.mp3",  "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", A7: "A7.mp3",
};

let masterInput: Tone.Reverb | null = null;
let sampler: Tone.Sampler | null = null;
let samplerLoaded = false;
let samplerConnected = false;

/**
 * The master chain input node. Instruments connect here; signal flows
 * reverb (small room, low wet) -> limiter (brickwall at -1 dB) -> destination.
 * Created once, lazily, on the first call.
 */
export function getMasterChain(): Tone.Reverb {
  if (!masterInput) {
    const limiter = new Tone.Limiter(-1).toDestination();
    const reverb = new Tone.Reverb({ decay: 1.3, preDelay: 0.01, wet: 0.14 });
    reverb.connect(limiter);
    masterInput = reverb;
  }
  return masterInput;
}

/**
 * The piano sampler, connected to the master chain. First call kicks off the
 * sample download; the returned sampler is playable immediately but silent until
 * loaded (callers should fall back to a synth via isSamplerReady() meanwhile).
 * The `release` is generous so notes ring like a real piano.
 */
export function getPianoSampler(): Tone.Sampler {
  if (!sampler) {
    sampler = new Tone.Sampler({
      urls: SAMPLE_URLS,
      baseUrl: SAMPLE_BASE_URL,
      release: 1.2,
      onload: () => { samplerLoaded = true; },
    });
  }
  // Defer building the master chain (which creates a Tone.Reverb that renders
  // its impulse response through an OfflineAudioContext) until the AudioContext
  // is actually running. Doing this on mount, before a user gesture, can hang
  // or fail on iOS/Safari. Playback paths call unlockAudio() first, so by the
  // time a note is triggered the context is running and this connect fires.
  if (!samplerConnected && Tone.getContext().state === "running") {
    sampler.connect(getMasterChain());
    samplerConnected = true;
  }
  return sampler;
}

/** Whether the sampler has finished loading its samples and will produce sound. */
export function isSamplerReady(): boolean {
  return samplerLoaded;
}

/**
 * Begin loading the piano samples ahead of first playback (idempotent). Safe to
 * call before the AudioContext is running — it only constructs the node graph.
 */
export function preloadPianoSampler(): void {
  getPianoSampler();
}
