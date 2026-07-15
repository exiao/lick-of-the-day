// Lazy loader for Tone.js so the ~60 kB (gzip) audio engine stays out of the
// initial bundle and only downloads when the user actually reaches for audio.
//
// The module is dynamically imported on the first user gesture (see the
// pointerdown preload in usePlayback) and cached. Callers that run *inside* an
// audio path (play / playNote after unlock) use getTone() synchronously; the
// async play() path awaits loadTone() directly.
import type * as ToneNS from "tone";

type ToneModule = typeof ToneNS;

let tonePromise: Promise<ToneModule> | null = null;
let toneMod: ToneModule | null = null;

/** Import Tone.js once and cache it. Idempotent; safe to call on every gesture. */
export function loadTone(): Promise<ToneModule> {
  if (!tonePromise) {
    tonePromise = import("tone").then((m) => {
      toneMod = m;
      return m;
    });
  }
  return tonePromise;
}

/** True once Tone.js has finished loading. Cheap synchronous guard. */
export function toneLoaded(): boolean {
  return toneMod !== null;
}

/**
 * Synchronous accessor for the loaded Tone module. Only call from paths that run
 * after loadTone() has resolved (playback, audioFullyUnlocked-gated fast path);
 * throws otherwise so a missing await surfaces loudly instead of silently no-oping.
 */
export function getTone(): ToneModule {
  if (!toneMod) {
    throw new Error("Tone.js accessed before load; await loadTone() first");
  }
  return toneMod;
}
