import { useState, useRef, useCallback, useEffect } from "react";
import * as Tone from "tone";
import type { Note, Articulation, Lick } from "../types/lick";
import { chordTimeToSeconds } from "../utils/chords";

// Articulation presets: velocity, attack, release, duration multiplier
const ARTICULATION_PRESETS: Record<Articulation, { velocity: number; attack: number; release: number; durationMod: number }> = {
  normal:   { velocity: 0.7,  attack: 0.005, release: 0.8,  durationMod: 1.0 },
  staccato: { velocity: 0.75, attack: 0.005, release: 0.1,  durationMod: 0.5 },
  legato:   { velocity: 0.65, attack: 0.02,  release: 1.5,  durationMod: 1.2 },
  accent:   { velocity: 0.95, attack: 0.001, release: 0.6,  durationMod: 1.0 },
  ghost:    { velocity: 0.3,  attack: 0.01,  release: 0.4,  durationMod: 0.8 },
};

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
  lick?: Pick<Lick, "swing" | "chords" | "timeSignature">,
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

    transport.bpm.value = tempo;
    transport.swing = lick?.swing ?? 0;
    transport.swingSubdivision = "8n";

    const tempoRatio = originalTempo / tempo;

    // --- Melody part ---
    const partEvents = notes.map((note, index) => ({
      time: note.time * tempoRatio,
      note,
      index,
    }));

    const part = new Tone.Part((time, event: { note: Note; index: number }) => {
      const { note, index } = event;
      const preset = ARTICULATION_PRESETS[note.articulation ?? "normal"];
      const velocity = note.velocity ?? preset.velocity;
      const baseDuration = Tone.Time(note.duration).toSeconds();
      const adjustedDuration = baseDuration * preset.durationMod;
      synth.triggerAttackRelease(note.pitch, adjustedDuration, time, velocity);
      Tone.getDraw().schedule(() => { setCurrentNoteIndex(index); }, time);
    }, partEvents);

    part.start(0);
    partRef.current = part;

    // --- Chord part ---
    const chords = lick?.chords;
    if (chordsEnabled && chords && chords.length > 0) {
      const chordSynth = getChordSynth();
      const beatsPerBar = lick?.timeSignature
        ? parseInt(lick.timeSignature.split("/")[0])
        : 4;

      // Use melody note times as the single source of truth for chord onsets.
      // For each chord at (bar, beat), find the first melody note at or after
      // that grid position and use its exact time — both voices hit together.
      const scaledNoteTimes = notes.map(n => n.time * tempoRatio);

      function melodyTimeAt(gridSecs: number): number {
        if (scaledNoteTimes.length === 0) return gridSecs;
        // First melody note at or after the grid position
        for (let i = 0; i < scaledNoteTimes.length; i++) {
          if (scaledNoteTimes[i] >= gridSecs - 0.01) return scaledNoteTimes[i];
        }
        // All melody notes are before this chord — use last note's time
        return scaledNoteTimes[scaledNoteTimes.length - 1];
      }

      // Build bass note events — just the root, one octave below middle C
      const chordEvents = chords.map((c, i) => {
        const gridSecs = chordTimeToSeconds(c.bar, c.beat, originalTempo, beatsPerBar) * tempoRatio;
        const startSecs = melodyTimeAt(gridSecs);
        const nextChord = chords[i + 1];
        const nextGrid = nextChord
          ? chordTimeToSeconds(nextChord.bar, nextChord.beat, originalTempo, beatsPerBar) * tempoRatio
          : (notes.length > 0 ? scaledNoteTimes[scaledNoteTimes.length - 1] + 2 : startSecs + 2);
        const endSecs = melodyTimeAt(nextGrid);
        const duration = Math.max(0.1, endSecs - startSecs - 0.05); // small gap between bass notes
        // Parse root from chord symbol (e.g. "Cm7" -> "C", "Bb7" -> "Bb")
        const rootMatch = c.chord.match(/^([A-G][b#]?)/);
        const root = rootMatch ? rootMatch[1] : "C";
        const bassNote = `${root}2`; // two octaves below middle C — deep, clear
        return { time: startSecs, bassNote, duration };
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
      const lastTime = notes[notes.length - 1].time * tempoRatio;
      transport.scheduleOnce(() => {
        Tone.getDraw().schedule(() => {
          setIsPlaying(false);
          setCurrentNoteIndex(-1);
        }, Tone.now());
        transport.stop();
      }, lastTime + 2.5);
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
