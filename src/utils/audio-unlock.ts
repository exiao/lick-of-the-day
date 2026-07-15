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

import { loadTone, getTone, toneLoaded } from "./tone-loader";

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
    const ctx = getTone().getContext().rawContext as AudioContext;
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
 * Start playing a silent HTMLMediaElement to promote the iOS audio session to
 * "playback" so the hardware mute switch no longer silences Web Audio. This must
 * be called SYNCHRONOUSLY inside the user gesture, before any await — iOS treats
 * the gesture as consumed after the first async hop and will reject play() that
 * comes too late. Returns the play() promise so the caller can await resolution;
 * mediaUnlocked is only set true once it actually resolves, so a rejected prime
 * gets retried on the next gesture.
 */
function startMediaPrime(): Promise<void> {
  if (mediaUnlocked) return Promise.resolve();
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
      return p
        .then(() => {
          mediaUnlocked = true;
        })
        .catch(() => {
          // Rejected — leave mediaUnlocked false so the next gesture retries.
        });
    }
    // Old browsers: play() returns void, treat as success.
    mediaUnlocked = true;
    return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

/**
 * Whether audio is fully unlocked: context running, buffer primed, and the
 * HTMLMediaElement prime has actually succeeded. When false, callers should
 * route through unlockAudio() again so a failed media prime gets retried.
 */
export function audioFullyUnlocked(): boolean {
  return (
    toneLoaded() &&
    mediaUnlocked &&
    bufferPrimed &&
    getTone().getContext().state === "running"
  );
}

/**
 * Unlock audio for iOS/iPadOS. Must be called synchronously from inside a user
 * gesture handler (click/touch). Safe to call repeatedly; it skips work that's
 * already done but keeps retrying the media prime until it actually succeeds.
 * Returns whether the AudioContext was resumed during this gesture. When Tone
 * has not finished its first dynamic import, it starts loading and asks the
 * caller to wait for the next real gesture instead of scheduling silent audio.
 */
export async function unlockAudio(): Promise<boolean> {
  // Fast path: fully unlocked and context running — no async work needed.
  if (audioFullyUnlocked()) {
    return true;
  }

  // Start the media prime FIRST, synchronously within the gesture, so iOS still
  // treats silentEl.play() as user-activated (awaiting the Tone import/start
  // first would consume the gesture and Safari could reject the play).
  const mediaPrime = startMediaPrime();

  // A dynamic import crosses an async boundary, which loses Safari's user
  // activation. Warm the module now, then require the next gesture to resume.
  if (!toneLoaded()) {
    void loadTone();
    await mediaPrime;
    return false;
  }

  // Tone is already loaded, so invoke start synchronously while this gesture is
  // still active. Await only its completion.
  const Tone = getTone();
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }

  primeBuffer();
  await mediaPrime;
  return true;
}
