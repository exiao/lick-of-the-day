import { useState, useRef, useCallback, useEffect } from "react";
import * as Tone from "tone";
import type { Note, Articulation, Genre, Lick } from "../types/lick";

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

// Convert Tone.js duration string to fraction of a whole note
// so we can accumulate musical time as "bars:beats:sixteenths"
function durationToBeats(dur: string): number {
  switch (dur) {
    case "1n":  return 4;
    case "2n":  return 2;
    case "2n.": return 3;
    case "4n":  return 1;
    case "4n.": return 1.5;
    case "8n":  return 0.5;
    case "8n.": return 0.75;
    case "16n": return 0.25;
    case "16n.": return 0.375;
    case "32n": return 0.125;
    default:    return 0.5; // fallback to eighth
  }
}

// Convert beat offset to Tone.js transport time string "bars:quarters:sixteenths"
function beatsToTransportTime(beats: number, beatsPerBar: number): string {
  const bars = Math.floor(beats / beatsPerBar);
  const remaining = beats - bars * beatsPerBar;
  const quarters = Math.floor(remaining);
  const sixteenths = (remaining - quarters) * 4;
  return `${bars}:${quarters}:${sixteenths}`;
}

interface UsePlaybackReturn {
  isPlaying: boolean;
  currentNoteIndex: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  playNote: (pitch: string) => void;
  tempo: number;
  setTempo: (bpm: number) => void;
  chordsEnabled: boolean;
  setChordsEnabled: (enabled: boolean) => void;
}

export function usePlayback(
  notes: Note[],
  originalTempo: number,
  lick?: Pick<Lick, "swing" | "chords" | "timeSignature" | "genre">,
): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [tempo, setTempoState] = useState(originalTempo);
  const [chordsEnabled, setChordsEnabled] = useState(true);

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const chordSynthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);
  const chordPartRef = useRef<Tone.Part | null>(null);

  useEffect(() => {
    setTempoState(originalTempo);
  }, [originalTempo]);

  const getSynth = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.8 },
      }).toDestination();
    }
    return synthRef.current;
  }, []);

  const getChordSynth = useCallback(() => {
    if (!chordSynthRef.current) {
      chordSynthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.3 },
      }).toDestination();
      chordSynthRef.current.volume.value = -8;
    }
    return chordSynthRef.current;
  }, []);

  const playNote = useCallback((pitch: string) => {
    getSynth().triggerAttackRelease(pitch, "8n");
  }, [getSynth]);

  const stop = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    if (partRef.current) { partRef.current.dispose(); partRef.current = null; }
    if (chordPartRef.current) { chordPartRef.current.dispose(); chordPartRef.current = null; }
    setIsPlaying(false);
    setCurrentNoteIndex(-1);
  }, []);

  const play = useCallback(async () => {
    await Tone.start();
    stop();

    const synth = getSynth();
    const transport = Tone.getTransport();
    const beatsPerBar = lick?.timeSignature
      ? parseInt(lick.timeSignature.split("/")[0])
      : 4;

    transport.bpm.value = tempo;
    transport.swing = lick?.swing ?? 0;
    transport.swingSubdivision = "8n";

    const genre = lick?.genre ?? "jazz";
    const genreMod = GENRE_SOUND_MULTIPLIER[genre] ?? 0.85;

    // --- Compute note times from duration sequence ---
    // Accumulate beat offsets so Tone.js transport handles swing/tempo.
    let beatCursor = 0;
    const partEvents = notes.map((note, index) => {
      const transportTime = beatsToTransportTime(beatCursor, beatsPerBar);
      const durationBeats = durationToBeats(note.duration);
      beatCursor += durationBeats;
      return { transportTime, note, index, durationBeats };
    });

    const totalBeats = beatCursor;

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
      // Capped at the full rhythmic duration so it never bleeds into the next note
      const slotSeconds = (60 / tempo) * durationBeats;
      const soundDuration = Math.min(slotSeconds, slotSeconds * genreMod * preset.durationMod);

      synth.triggerAttackRelease(note.pitch, soundDuration, time, velocity);
      Tone.getDraw().schedule(() => { setCurrentNoteIndex(index); }, time);
    }, partEvents.map(e => ({ time: e.transportTime, note: e.note, index: e.index, durationBeats: e.durationBeats })));

    part.start(0);
    partRef.current = part;

    // --- Chord part (bass notes on the same transport grid) ---
    const chords = lick?.chords;
    if (chordsEnabled && chords && chords.length > 0) {
      const chordSynth = getChordSynth();

      const chordEvents = chords.map((c, i) => {
        // Convert bar/beat to beat offset (both 1-indexed in the data)
        const chordBeat = (c.bar - 1) * beatsPerBar + (c.beat - 1);
        const transportTime = beatsToTransportTime(chordBeat, beatsPerBar);

        // Duration: until next chord or end of lick
        const nextChord = chords[i + 1];
        const nextBeat = nextChord
          ? (nextChord.bar - 1) * beatsPerBar + (nextChord.beat - 1)
          : totalBeats;
        const durationBeats = Math.max(0.5, nextBeat - chordBeat);
        const durationSecs = (60 / tempo) * durationBeats - 0.05; // small gap

        const rootMatch = c.chord.match(/^([A-G][b#]?)/);
        const root = rootMatch ? rootMatch[1] : "C";
        const bassNote = `${root}2`;

        return { time: transportTime, bassNote, duration: Math.max(0.1, durationSecs) };
      });

      const chordPart = new Tone.Part(
        (time, event: { bassNote: string; duration: number }) => {
          chordSynth.triggerAttackRelease(event.bassNote, event.duration, time, 0.5);
        },
        chordEvents,
      );
      chordPart.start(0);
      chordPartRef.current = chordPart;
    }

    // Stop after last note
    if (notes.length > 0) {
      const endTime = beatsToTransportTime(totalBeats + 2, beatsPerBar);
      transport.scheduleOnce(() => {
        Tone.getDraw().schedule(() => {
          setIsPlaying(false);
          setCurrentNoteIndex(-1);
        }, Tone.now());
        transport.stop();
      }, endTime);
    }

    transport.start();
    setIsPlaying(true);
  }, [notes, tempo, originalTempo, lick, chordsEnabled, getSynth, getChordSynth, stop]);

  const pause = useCallback(() => {
    if (isPlaying) {
      Tone.getTransport().pause();
      setIsPlaying(false);
    } else {
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const setTempo = useCallback((bpm: number) => {
    setTempoState(bpm);
    Tone.getTransport().bpm.value = bpm;
  }, []);

  useEffect(() => {
    return () => {
      stop();
      synthRef.current?.dispose();
      synthRef.current = null;
      chordSynthRef.current?.dispose();
      chordSynthRef.current = null;
    };
  }, [stop]);

  return { isPlaying, currentNoteIndex, play, pause, stop, playNote, tempo, setTempo, chordsEnabled, setChordsEnabled };
}
