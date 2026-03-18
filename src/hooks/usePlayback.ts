import { useState, useRef, useCallback, useEffect } from "react";
import * as Tone from "tone";
import type { Note } from "../types/lick";

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

export function usePlayback(notes: Note[], originalTempo: number): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [tempo, setTempoState] = useState(originalTempo);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  // Reset tempo when lick changes
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
    const synth = getSynth();
    synth.triggerAttackRelease(pitch, "8n");
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

    // Use a fixed BPM and convert all note times to beat-relative positions.
    // This lets Tone.Part handle timing precisely in a single scheduled unit.
    transport.bpm.value = tempo;

    const tempoRatio = originalTempo / tempo;

    // Build note events for Tone.Part: [timeInSeconds, { pitch, duration, index }]
    const partEvents = notes.map((note, index) => ({
      time: note.time * tempoRatio,
      pitch: note.pitch,
      duration: note.duration,
      index,
    }));

    const part = new Tone.Part((time, event) => {
      synth.triggerAttackRelease(event.pitch, event.duration, time);
      // Update UI on the main thread
      Tone.getDraw().schedule(() => {
        setCurrentNoteIndex(event.index);
      }, time);
    }, partEvents);

    part.start(0);

    // Schedule stop after last note finishes
    if (notes.length > 0) {
      const lastNote = notes[notes.length - 1];
      const lastTime = lastNote.time * tempoRatio;
      // Add generous buffer for the last note to ring out
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
  }, [notes, tempo, originalTempo, getSynth, stop]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      synthRef.current?.dispose();
      synthRef.current = null;
    };
  }, [stop]);

  return { isPlaying, currentNoteIndex, play, pause, stop, playNote, tempo, setTempo };
}
