// iOS / iPadOS Web Audio unlock helpers.
//
// iPad Safari refuses to play Web Audio until two things happen:
//   1. The AudioContext is resumed inside a real user gesture (Tone.start handles this).
//   2. The page has played at least one HTMLMediaElement so iOS promotes the tab from
//      the "ambient" audio session (silenced by the hardware mute switch) to "playback".
//
// Without step 2, audio is dead whenever the iPad's physical mute switch or the
// Control Center mute is engaged, even though every native app still plays. This
// module primes a silent <audio> element and an empty buffer on the first gesture
// so Tone.js output survives the silent switch.

import * as Tone from "tone";

// Tracked separately: the context can resume while the HTMLMediaElement prime
// fails (e.g. a media-policy rejection). We must keep retrying the media prime on
// later gestures until it actually starts, or the iPad stays in the ambient
// (mute-switch-silenced) session.
let bufferPrimed = false;
let mediaUnlocked = false;
let silentEl: HTMLAudioElement | null = null;

// A 0.05s silent WAV (mono, 8kHz) encoded as a data URI. Playing this on a gesture
// flips iOS into the media playback audio session that ignores the mute switch.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICA";

/** Prime a one-sample Web Audio buffer (older iOS needs a rendered node). */
function primeBuffer(): void {
  if (bufferPrimed) return;
  try {
    const ctx = Tone.getContext().rawContext as AudioContext;
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    bufferPrimed = true;
  } catch {
    /* no-op */
  }
}

/**
 * Play a silent HTMLMediaElement to promote the iOS audio session to "playback"
 * so the hardware mute switch no longer silences Web Audio. Only marks the media
 * unlock complete once play() actually resolves — if it's rejected, a later
 * gesture retries it. Must be called from inside a user gesture.
 */
async function primeMedia(): Promise<void> {
  if (mediaUnlocked) return;
  try {
    if (!silentEl) {
      silentEl = new Audio(SILENT_WAV);
      silentEl.loop = false;
      silentEl.preload = "auto";
      // playsInline keeps iOS from hijacking into fullscreen for media.
      silentEl.setAttribute("playsinline", "");
      silentEl.muted = false;
      silentEl.volume = 0.0001;
    }
    const p = silentEl.play();
    if (p && typeof p.then === "function") {
      await p;
    }
    // Only reached if play() resolved (or returned no promise on old browsers).
    mediaUnlocked = true;
  } catch {
    // play() was rejected — leave mediaUnlocked false so the next real gesture
    // retries the prime instead of permanently skipping it.
  }
}

/**
 * Whether audio is fully unlocked: context running, buffer primed, and the
 * HTMLMediaElement prime has actually succeeded. When false, callers should
 * route through unlockAudio() again so a failed media prime gets retried.
 */
export function audioFullyUnlocked(): boolean {
  return mediaUnlocked && bufferPrimed && Tone.getContext().state === "running";
}

/**
 * Unlock audio for iOS/iPadOS. Must be called synchronously from inside a user
 * gesture handler (click/touch). Safe to call repeatedly; it skips work that's
 * already done but keeps retrying the media prime until it actually succeeds.
 * Returns a promise that resolves once the AudioContext is running.
 */
export async function unlockAudio(): Promise<void> {
  // Fast path: fully unlocked and context running — no async work needed.
  if (mediaUnlocked && bufferPrimed && Tone.getContext().state === "running") {
    return;
  }

  // Resume the Tone/Web Audio context (required on all browsers).
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }

  primeBuffer();
  await primeMedia();
}
