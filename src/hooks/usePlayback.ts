import { useState, useRef, useCallback, useEffect } from "react";
import * as Tone from "tone";
import type { Note, Articulation, Lick } from "../types/lick";

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
}

export function usePlayback(notes: Note[], originalTempo: number, lick?: Pick<Lick, "swing">): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [tempo, setTempoState] = useState(originalTempo);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

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

  const playNote = useCallback((pitch: string) => {
    getSynth().triggerAttackRelease(pitch, "8n");
  }, [getSynth]);

  const stop = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    if (partRef.current) {
      partRef.current.dispose();
      partRef.current = null;
    }
    setIsPlaying(false);
    setCurrentNoteIndex(-1);
  }, []);

  const play = useCallback(async () => {
    await Tone.start();
    stop();

    const synth = getSynth();
    const transport = Tone.getTransport();

    transport.bpm.value = tempo;

    // Apply swing — Tone.js handles the upbeat eighth offset natively
    transport.swing = lick?.swing ?? 0;
    transport.swingSubdivision = "8n";

    const tempoRatio = originalTempo / tempo;

    const partEvents = notes.map((note, index) => ({
      time: note.time * tempoRatio,
      note,
      index,
    }));

    const part = new Tone.Part((time, event: { note: Note; index: number }) => {
      const { note, index } = event;
      const preset = ARTICULATION_PRESETS[note.articulation ?? "normal"];
      const velocity = note.velocity ?? preset.velocity;

      // Apply per-note envelope override if provided
      if (note.attack !== undefined || note.release !== undefined) {
        synth.set({
          envelope: {
            attack: note.attack ?? preset.attack,
            release: note.release ?? preset.release,
          },
        });
      } else {
        synth.set({
          envelope: { attack: preset.attack, release: preset.release },
        });
      }

      // Adjust duration by articulation modifier
      const baseDuration = Tone.Time(note.duration).toSeconds();
      const adjustedDuration = baseDuration * preset.durationMod;

      synth.triggerAttackRelease(note.pitch, adjustedDuration, time, velocity);

      Tone.getDraw().schedule(() => {
        setCurrentNoteIndex(index);
      }, time);
    }, partEvents);

    part.start(0);

    if (notes.length > 0) {
      const lastNote = notes[notes.length - 1];
      const lastTime = lastNote.time * tempoRatio;
      transport.scheduleOnce(() => {
        Tone.getDraw().schedule(() => {
          setIsPlaying(false);
          setCurrentNoteIndex(-1);
        }, Tone.now());
        transport.stop();
      }, lastTime + 1.5);
    }

    partRef.current = part;
    transport.start();
    setIsPlaying(true);
  }, [notes, tempo, originalTempo, lick, getSynth, stop]);

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
    };
  }, [stop]);

  return { isPlaying, currentNoteIndex, play, pause, stop, playNote, tempo, setTempo };
}
