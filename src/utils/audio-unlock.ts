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

let unlocked = false;
let silentEl: HTMLAudioElement | null = null;

// A 0.05s silent WAV (mono, 8kHz) encoded as a data URI. Playing this on a gesture
// flips iOS into the media playback audio session that ignores the mute switch.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICA";

/**
 * Unlock audio for iOS/iPadOS. Must be called synchronously from inside a user
 * gesture handler (click/touch). Safe to call repeatedly; only the first call
 * does work. Returns a promise that resolves once the AudioContext is running.
 */
export async function unlockAudio(): Promise<void> {
  // Resume the Tone/Web Audio context (required on all browsers).
  await Tone.start();

  if (unlocked) return;

  // Prime a silent HTMLAudioElement to promote the iOS audio session to "playback"
  // so the hardware mute switch no longer silences Web Audio output.
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
      await p.catch(() => {
        /* Autoplay rejection is fine; the gesture still unlocks the context. */
      });
    }
  } catch {
    /* Ignore — the Tone.start() resume above is the critical path. */
  }

  // Play one inaudible buffer through the Web Audio graph as a belt-and-suspenders
  // unlock for older iOS that needs a node to actually render.
  try {
    const ctx = Tone.getContext().rawContext as AudioContext;
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* no-op */
  }

  unlocked = true;
}
