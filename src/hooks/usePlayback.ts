import { useState, useRef, useCallback, useEffect } from "react";
import type * as Tone from "tone";
import { getTone, toneLoaded } from "../utils/tone-loader";
import { unlockAudio, audioFullyUnlocked } from "../utils/audio-unlock";
import {
  getMasterChain,
  getPianoSampler,
  isSamplerReady,
} from "../utils/piano-sampler";
import { durationToBeats, noteOnsets } from "../utils/music";
import { compVoicing } from "../utils/chords";
import type { Note, Articulation, Genre, Lick } from "../types/lick";
import {
  buildBassLine, buildDrumPattern, defaultGrooveStyle, stepToTransportTime, GROOVE_SWING_SUBDIVISION,
  type BassHit, type DrumHit, type GrooveStyle,
} from "../audio/groove";
import { createDrumKit, createGrooveBass, type DrumKit, type GrooveBass } from "../audio/drum-kit";

// Articulation presets: velocity, attack, release, duration multiplier
const ARTICULATION_PRESETS: Record<Articulation, { velocity: number; attack: number; release: number; durationMod: number }> = {
  normal:   { velocity: 0.7,  attack: 0.005, release: 0.8,  durationMod: 1.0 },
  staccato: { velocity: 0.75, attack: 0.005, release: 0.1,  durationMod: 0.5 },
  legato:   { velocity: 0.65, attack: 0.02,  release: 1.5,  durationMod: 1.2 },
  accent:   { velocity: 0.95, attack: 0.001, release: 0.6,  durationMod: 1.0 },
  ghost:    { velocity: 0.3,  attack: 0.01,  release: 0.4,  durationMod: 0.8 },
};

// Genre-based sound duration multiplier.
// This controls how long the note *sounds* relative to its rhythmic slot.
// A short multiplier = staccato/punchy feel. Long = smooth/connected.
// The note still occupies its full rhythmic duration before the next note plays.
const GENRE_SOUND_MULTIPLIER: Record<Genre, number> = {
  funk:  0.5,   // tight, punchy
  blues: 0.75,  // slightly detached
  jazz:  0.9,   // connected, flowing
  rnb:   0.85,  // smooth
  bossa: 0.8,   // gentle
};

// Convert beat offset to Tone.js transport time string "bars:quarters:sixteenths"
function beatsToTransportTime(beats: number, beatsPerBar: number): string {
  const bars = Math.floor(beats / beatsPerBar);
  const remaining = beats - bars * beatsPerBar;
  const quarters = Math.floor(remaining);
  const sixteenths = (remaining - quarters) * 4;
  return `${bars}:${quarters}:${sixteenths}`;
}

type Voice = Tone.Sampler | Tone.PolySynth;

/** A tiny external store for the 16th-note playhead, read with useSyncExternalStore. */
export interface StepStore {
  get: () => number;
  subscribe: (listener: () => void) => () => void;
}
function createStepStore(): StepStore & { set: (step: number) => void } {
  let value = -1;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (step) => {
      if (step === value) return;
      value = step;
      listeners.forEach(l => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// Placeholders for "key is down but audio is still unlocking" (one per press,
// so only the press that created it acts when the unlock resolves).
const pendingVoices = new WeakSet<Voice>();
const isPending = (v: Voice | undefined) => v !== undefined && pendingVoices.has(v);

interface UsePlaybackReturn {
  isPlaying: boolean;
  currentNoteIndex: number;
  /** Beat (0-based, from the top of the lick) under the playhead, or -1. */
  currentBeat: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  /** Press/release a key: sustains while held, like a real keyboard. */
  noteOn: (pitch: string) => void;
  noteOff: (pitch: string) => void;
  tempo: number;
  setTempo: (bpm: number) => void;
  swing: number;
  setSwing: (amount: number) => void;
  chordsEnabled: boolean;
  setChordsEnabled: (enabled: boolean) => void;
  loopEnabled: boolean;
  setLoopEnabled: (enabled: boolean) => void;
  clickEnabled: boolean;
  setClickEnabled: (enabled: boolean) => void;
  grooveStyle: GrooveStyle;
  setGrooveStyle: (style: GrooveStyle) => void;
  drumsEnabled: boolean;
  setDrumsEnabled: (enabled: boolean) => void;
  bassEnabled: boolean;
  setBassEnabled: (enabled: boolean) => void;
  /** 16th-note step under the playhead (-1 when stopped). */
  steps: StepStore;
}

export function usePlayback(
  notes: Note[],
  originalTempo: number,
  lick?: Pick<Lick, "id" | "swing" | "chords" | "timeSignature" | "genre">,
): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [tempo, setTempoState] = useState(originalTempo);
  const [swing, setSwingState] = useState(lick?.swing ?? 0);
  const [chordsEnabled, setChordsEnabled] = useState(true);
  const [loopEnabled, setLoopState] = useState(false);
  const [clickEnabled, setClickState] = useState(false);
  const defaultStyle = defaultGrooveStyle(lick?.genre ?? "jazz");
  const [grooveStyle, setGrooveStyleState] = useState<GrooveStyle>(defaultStyle);
  const [drumsEnabled, setDrumsState] = useState(true);
  const [bassEnabled, setBassState] = useState(true);
  const [stepStore] = useState(createStepStore);

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const bassSynthRef = useRef<Tone.PolySynth | null>(null);
  const clickSynthRef = useRef<Tone.Synth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);
  const chordPartRef = useRef<Tone.Part | null>(null);
  const drumPartRef = useRef<Tone.Part | null>(null);
  const bassPartRef = useRef<Tone.Part | null>(null);
  const drumKitRef = useRef<DrumKit | null>(null);
  const grooveBassRef = useRef<GrooveBass | null>(null);
  // Read inside scheduled callbacks so toggling a layer mid-loop is immediate.
  const clickRef = useRef(clickEnabled);
  const chordsRef = useRef(chordsEnabled);
  const drumsRef = useRef(drumsEnabled);
  const bassRef = useRef(bassEnabled);
  const grooveStyleRef = useRef(grooveStyle);
  const grooveBassOn = () => bassRef.current;
  // Which instrument each held key went to, so the release reaches the same one
  // even if the sampler finishes loading while the key is down.
  const heldRef = useRef<Map<string, Voice>>(new Map());

  // Reset tempo/swing per lick (not per value), so a practice tempo set on one
  // lick never leaks into the next lick that happens to share its tempo.
  const lickKey = `${lick?.id ?? ""}|${originalTempo}|${lick?.swing ?? 0}|${defaultStyle}`;
  const [trackedLickKey, setTrackedLickKey] = useState(lickKey);
  if (trackedLickKey !== lickKey) {
    setTrackedLickKey(lickKey);
    setTempoState(originalTempo);
    setSwingState(lick?.swing ?? 0);
    setGrooveStyleState(defaultStyle);
    if (trackedLickKey.split("|")[0] !== (lick?.id ?? "")) {
      setIsPlaying(false);
      setCurrentNoteIndex(-1);
      setCurrentBeat(-1);
    }
  }
  useEffect(() => { grooveStyleRef.current = grooveStyle; }, [grooveStyle]);

  const getSynth = useCallback(() => {
    if (!synthRef.current) {
      const T = getTone();
      synthRef.current = new T.PolySynth(T.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.8 },
      }).connect(getMasterChain());
      // The triangle synth is louder than the sampled piano; trim it so the
      // fallback->sampler switch mid-session isn't a jarring volume drop.
      synthRef.current.volume.value = -12;
    }
    return synthRef.current;
  }, []);

  // Round, upright-ish bass for the comp's root motion.
  const getBassSynth = useCallback(() => {
    if (!bassSynthRef.current) {
      const T = getTone();
      bassSynthRef.current = new T.PolySynth(T.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.35, release: 0.25 },
      }).connect(getMasterChain());
      bassSynthRef.current.volume.value = -6;
    }
    return bassSynthRef.current;
  }, []);

  const getClickSynth = useCallback(() => {
    if (!clickSynthRef.current) {
      const T = getTone();
      clickSynthRef.current = new T.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      }).connect(getMasterChain());
      clickSynthRef.current.volume.value = -14;
    }
    return clickSynthRef.current;
  }, []);

  // The piano sampler once its samples have loaded, otherwise the triangle synth.
  const melodyVoice = useCallback((): Voice => (isSamplerReady() ? getPianoSampler() : getSynth()), [getSynth]);

  const triggerMelody = useCallback(
    (pitch: string | string[], duration: Tone.Unit.Time, time?: number, velocity?: number) => {
      melodyVoice().triggerAttackRelease(pitch, duration, time, velocity);
    },
    [melodyVoice],
  );

  const noteOn = useCallback((pitch: string) => {
    const attack = () => {
      const voice = melodyVoice();
      const prev = heldRef.current.get(pitch);
      if (prev && !isPending(prev)) prev.triggerRelease(pitch);
      voice.triggerAttack(pitch, undefined, 0.75);
      heldRef.current.set(pitch, voice);
    };
    if (audioFullyUnlocked()) {
      attack();
      return;
    }
    // First touch: the unlock is async. Mark the key held now; if it's already
    // been released by the time audio is ready, play a short tap instead.
    const pending = {} as Voice;
    pendingVoices.add(pending);
    heldRef.current.set(pitch, pending);
    void unlockAudio().then((unlocked) => {
      if (!unlocked) return;
      const current = heldRef.current.get(pitch);
      if (current === pending) attack();
      else if (current === undefined) triggerMelody(pitch, "8n");
      // else: a later press of the same key owns it now.
    });
  }, [melodyVoice, triggerMelody]);

  const noteOff = useCallback((pitch: string) => {
    const voice = heldRef.current.get(pitch);
    heldRef.current.delete(pitch);
    if (voice && !isPending(voice)) voice.triggerRelease(pitch);
  }, []);

  // Latest inputs for the scheduling helpers, so a live edit or groove change can
  // rebuild one layer mid-loop without restarting the transport.
  const notesRef = useRef(notes);
  const lickRef = useRef(lick);
  useEffect(() => {
    notesRef.current = notes;
    lickRef.current = lick;
  });

  // Stop the transport and drop every scheduled layer (no React state).
  const teardown = useCallback(() => {
    stepStore.set(-1);
    if (!toneLoaded()) return;
    const transport = getTone().getTransport();
    transport.stop();
    transport.cancel();
    // Drop UI callbacks already queued for the next frames, or a late one
    // re-lights the playhead after it was cleared below.
    getTone().getDraw().cancel(0);
    transport.loop = false;
    for (const ref of [partRef, chordPartRef, drumPartRef, bassPartRef]) {
      ref.current?.dispose();
      ref.current = null;
    }
  }, [stepStore]);

  const stop = useCallback(() => {
    teardown();
    setIsPlaying(false);
    setCurrentNoteIndex(-1);
    setCurrentBeat(-1);
  }, [teardown]);

  /** Beats per bar, the melody's beat length and the whole-bar loop length. */
  const form = useCallback(() => {
    const ts = lickRef.current?.timeSignature;
    const beatsPerBar = ts ? parseInt(ts.split("/")[0]) || 4 : 4;
    const totalBeats = notesRef.current.reduce((s, n) => s + durationToBeats(n.duration), 0);
    // Loop on whole bars so the form (and the groove) stays square.
    const loopBeats = Math.max(beatsPerBar, Math.ceil(totalBeats / beatsPerBar) * beatsPerBar);
    return { beatsPerBar, totalBeats, loopBeats };
  }, []);

  const scheduleMelody = useCallback(() => {
    partRef.current?.dispose();
    const Tone = getTone();
    const transport = Tone.getTransport();
    const { beatsPerBar } = form();
    const genre = lickRef.current?.genre ?? "jazz";
    const genreMod = GENRE_SOUND_MULTIPLIER[genre] ?? 0.85;

    // --- Compute note times from duration sequence ---
    // Accumulate beat offsets so Tone.js transport handles swing/tempo.
    const partEvents = noteOnsets(notesRef.current).map((onsetBeats, index) => {
      const note = notesRef.current[index];
      return { time: beatsToTransportTime(onsetBeats, beatsPerBar), onsetBeats, note, index, durationBeats: durationToBeats(note.duration) };
    });

    const part = new Tone.Part((time, event: { note: Note; index: number; durationBeats: number }) => {
      const { note, index, durationBeats } = event;
      // Rests: advance the highlight cursor but produce no sound
      if (note.pitch === "rest") {
        Tone.getDraw().schedule(() => { setCurrentNoteIndex(index); }, time);
        return;
      }

      const preset = ARTICULATION_PRESETS[note.articulation ?? "normal"];
      const velocity = note.velocity ?? preset.velocity;

      // Sound duration = rhythmic slot * genre multiplier * articulation multiplier
      // Capped at the full rhythmic duration so it never bleeds into the next note.
      // Read the live bpm so knob changes mid-loop keep durations in proportion.
      const slotSeconds = (60 / transport.bpm.value) * durationBeats;
      const soundDuration = Math.min(slotSeconds, slotSeconds * genreMod * preset.durationMod);

      triggerMelody(note.pitch, soundDuration, time, velocity);
      Tone.getDraw().schedule(() => { setCurrentNoteIndex(index); }, time);
    }, partEvents);

    part.start(0);
    partRef.current = part;
    return partEvents.map(e => e.onsetBeats);
  }, [form, triggerMelody]);

  // --- Comp: bass root + 3rd/7th shell, snapped to the melody timeline ---
  const scheduleComp = useCallback((melodyOnsets: number[]) => {
    chordPartRef.current?.dispose();
    chordPartRef.current = null;
    const chords = lickRef.current?.chords;
    if (!chords || chords.length === 0) return;
    const Tone = getTone();
    const transport = Tone.getTransport();
    const { beatsPerBar, loopBeats } = form();

    const chordEvents = chords.flatMap((c, i) => {
      const voicing = compVoicing(c.chord);
      if (!voicing) return [];
      const targetBeat = (c.bar - 1) * beatsPerBar + (c.beat - 1);

      // Snap to the nearest melody onset within half a beat; otherwise keep
      // the grid position.
      let snappedBeat = targetBeat;
      let minDist = Infinity;
      for (const onset of melodyOnsets) {
        const dist = Math.abs(onset - targetBeat);
        if (dist < minDist) {
          minDist = dist;
          snappedBeat = onset;
        }
      }
      if (minDist > 0.5) snappedBeat = targetBeat;

      // Duration: until next chord or the end of the (looped) form
      const nextChord = chords[i + 1];
      const nextTargetBeat = nextChord
        ? (nextChord.bar - 1) * beatsPerBar + (nextChord.beat - 1)
        : loopBeats;
      const durationBeats = Math.max(0.5, nextTargetBeat - snappedBeat);

      return [{ time: beatsToTransportTime(snappedBeat, beatsPerBar), durationBeats, ...voicing }];
    });

    const bass = getBassSynth();
    const chordPart = new Tone.Part(
      (time, event: { bass: string; shell: string[]; durationBeats: number }) => {
        if (!chordsRef.current) return;
        const secs = Math.max(0.1, (60 / transport.bpm.value) * event.durationBeats - 0.05);
        // The groove bass owns the low end while it's playing; the comp keeps
        // its sustained root only when the groove bass is muted.
        if (!grooveBassOn()) bass.triggerAttackRelease(event.bass, secs, time, 0.55);
        // Shell voicing through the piano, a touch late and soft, like a comping left hand.
        triggerMelody(event.shell, Math.min(secs, 1.6), time + 0.012, 0.32);
      },
      chordEvents,
    );
    chordPart.start(0);
    chordPartRef.current = chordPart;
  }, [form, getBassSynth, triggerMelody]);

  // --- Groove: synthesized drums + a bass line that follows the changes ---
  const scheduleGroove = useCallback(() => {
    drumPartRef.current?.dispose();
    bassPartRef.current?.dispose();
    drumPartRef.current = null;
    bassPartRef.current = null;
    const Tone = getTone();
    const transport = Tone.getTransport();
    const { beatsPerBar, loopBeats } = form();
    const bars = loopBeats / beatsPerBar;
    const style = grooveStyleRef.current;
    // Neo-soul pockets swing the 16ths; soul backbeats and jazz swing the 8ths.
    transport.swingSubdivision = GROOVE_SWING_SUBDIVISION[style];

    if (!drumKitRef.current) drumKitRef.current = createDrumKit(Tone, getMasterChain());
    if (!grooveBassRef.current) grooveBassRef.current = createGrooveBass(Tone, getMasterChain());
    const kit = drumKitRef.current;
    const bassVoice = grooveBassRef.current;

    const drumPart = new Tone.Part(
      (time, hit: DrumHit) => {
        if (drumsRef.current) kit.trigger(hit.voice, time, hit.velocity);
      },
      buildDrumPattern(style, bars, beatsPerBar).map(h => ({ ...h, time: stepToTransportTime(h.step, beatsPerBar) })),
    );
    drumPart.start(0);
    drumPartRef.current = drumPart;

    const bassPart = new Tone.Part(
      (time, hit: BassHit) => {
        if (!bassRef.current) return;
        // A hair short of the slot so repeated roots re-articulate.
        const secs = Math.max(0.05, (60 / transport.bpm.value) * (hit.lengthSteps / 4) * 0.92);
        bassVoice.trigger(hit.pitch, secs, time, hit.velocity);
      },
      buildBassLine(style, lickRef.current?.chords ?? [], bars, beatsPerBar)
        .map(h => ({ ...h, time: stepToTransportTime(h.step, beatsPerBar) })),
    );
    bassPart.start(0);
    bassPartRef.current = bassPart;
  }, [form]);

  const play = useCallback(async () => {
    if (!(await unlockAudio())) return;
    // Keep the transport position and scheduled parts when resuming a pause.
    const existingTransport = getTone().getTransport();
    if (partRef.current && existingTransport.state === "paused") {
      existingTransport.start();
      setIsPlaying(true);
      return;
    }
    stop();

    const Tone = getTone();
    const transport = Tone.getTransport();
    const { beatsPerBar, totalBeats, loopBeats } = form();

    transport.bpm.value = tempo;
    transport.swing = swing;

    const melodyOnsets = scheduleMelody();
    scheduleComp(melodyOnsets);
    scheduleGroove();

    // --- Beat pulse (drives the display LEDs) + optional click ---
    transport.scheduleRepeat((time) => {
      const beat = Math.round(transport.getTicksAtTime(time) / transport.PPQ) % loopBeats;
      if (clickRef.current) {
        getClickSynth().triggerAttackRelease(beat % beatsPerBar === 0 ? "G6" : "C6", 0.03, time, 0.6);
      }
      Tone.getDraw().schedule(() => { setCurrentBeat(beat); }, time);
    }, "4n", 0);

    // --- 16th-note playhead for the step sequencer (outside React state, so
    // only the sequencer re-renders at this rate) ---
    const loopSteps = loopBeats * 4;
    transport.scheduleRepeat((time) => {
      // Floor, not round: the callback time is already swung late, so rounding
      // would light the next pad on heavily swung off-beats.
      const step = Math.floor(transport.getTicksAtTime(time) / (transport.PPQ / 4) + 1e-3) % loopSteps;
      Tone.getDraw().schedule(() => stepStore.set(step), time);
    }, "16n", 0);

    transport.setLoopPoints(0, beatsToTransportTime(loopBeats, beatsPerBar));
    transport.loop = loopEnabled;

    // Stop after the form (never reached while looping; turning the loop off
    // mid-play lets the transport run on into this).
    if (notesRef.current.length > 0) {
      const endTime = beatsToTransportTime(Math.max(totalBeats, loopBeats) + 1, beatsPerBar);
      transport.scheduleOnce(() => {
        Tone.getDraw().schedule(() => {
          setIsPlaying(false);
          setCurrentNoteIndex(-1);
          setCurrentBeat(-1);
          stepStore.set(-1);
        }, Tone.now());
        transport.stop();
      }, endTime);
    }

    transport.start();
    setIsPlaying(true);
  }, [tempo, swing, loopEnabled, form, scheduleMelody, scheduleComp, scheduleGroove, getClickSynth, stop, stepStore]);

  // A different lick (e.g. today's lick arriving while the fallback plays)
  // never plays inside the previous lick's form, tempo or groove.
  const lickId = lick?.id;
  // (The UI state resets during render with the tempo, below the lick key.)
  useEffect(() => {
    if (partRef.current) teardown();
  }, [lickId, teardown]);

  // Live edits: rebuild the melody (and the comp that snaps to it) in place so
  // the next pass of the loop plays exactly what the sequencer and staff show.
  useEffect(() => {
    if (!toneLoaded() || !partRef.current) return;
    scheduleComp(scheduleMelody());
  }, [notes, scheduleMelody, scheduleComp]);

  const pause = useCallback(() => {
    if (!toneLoaded()) return;
    if (isPlaying) {
      getTone().getTransport().pause();
      setIsPlaying(false);
    } else {
      getTone().getTransport().start();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const setTempo = useCallback((bpm: number) => {
    setTempoState(bpm);
    if (toneLoaded()) getTone().getTransport().bpm.value = bpm;
  }, []);

  const setSwing = useCallback((amount: number) => {
    setSwingState(amount);
    if (toneLoaded()) getTone().getTransport().swing = amount;
  }, []);

  const setLoopEnabled = useCallback((enabled: boolean) => {
    setLoopState(enabled);
    if (toneLoaded()) getTone().getTransport().loop = enabled;
  }, []);

  const setClickEnabled = useCallback((enabled: boolean) => {
    clickRef.current = enabled;
    setClickState(enabled);
  }, []);

  const setChordsEnabledLive = useCallback((enabled: boolean) => {
    chordsRef.current = enabled;
    setChordsEnabled(enabled);
  }, []);

  const setDrumsEnabled = useCallback((enabled: boolean) => {
    drumsRef.current = enabled;
    setDrumsState(enabled);
  }, []);

  const setBassEnabled = useCallback((enabled: boolean) => {
    bassRef.current = enabled;
    setBassState(enabled);
  }, []);

  // Switching the groove mid-loop swaps the pattern (and the swing grid) in place.
  const setGrooveStyle = useCallback((style: GrooveStyle) => {
    grooveStyleRef.current = style;
    setGrooveStyleState(style);
    if (toneLoaded() && drumPartRef.current) scheduleGroove();
  }, [scheduleGroove]);

  // Release anything still held if the tab loses focus (keyup never arrives).
  useEffect(() => {
    const releaseAll = () => {
      for (const [pitch, voice] of heldRef.current) {
        if (!isPending(voice)) voice.triggerRelease(pitch);
      }
      heldRef.current.clear();
    };
    window.addEventListener("blur", releaseAll);
    return () => window.removeEventListener("blur", releaseAll);
  }, []);

  useEffect(() => {
    return () => {
      stop();
      synthRef.current?.dispose();
      synthRef.current = null;
      bassSynthRef.current?.dispose();
      bassSynthRef.current = null;
      clickSynthRef.current?.dispose();
      clickSynthRef.current = null;
      drumKitRef.current?.dispose();
      drumKitRef.current = null;
      grooveBassRef.current?.dispose();
      grooveBassRef.current = null;
    };
  }, [stop]);

  return {
    isPlaying, currentNoteIndex, currentBeat, play, pause, stop, noteOn, noteOff,
    tempo, setTempo, swing, setSwing, chordsEnabled, setChordsEnabled: setChordsEnabledLive,
    loopEnabled, setLoopEnabled, clickEnabled, setClickEnabled,
    grooveStyle, setGrooveStyle, drumsEnabled, setDrumsEnabled, bassEnabled, setBassEnabled,
    steps: stepStore,
  };
}
