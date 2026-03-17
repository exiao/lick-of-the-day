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
  const eventsRef = useRef<Tone.ToneEvent[]>([]);

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
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    eventsRef.current.forEach(e => e.dispose());
    eventsRef.current = [];
    setIsPlaying(false);
    setCurrentNoteIndex(-1);
  }, []);

  const play = useCallback(async () => {
    await Tone.start();
    stop();

    const synth = getSynth();
    const transport = Tone.getTransport();
    transport.bpm.value = tempo;

    const tempoRatio = originalTempo / tempo;
    const events: Tone.ToneEvent[] = [];

    notes.forEach((note, index) => {
      const adjustedTime = note.time * tempoRatio;
      const event = new Tone.ToneEvent(() => {
        setCurrentNoteIndex(index);
        synth.triggerAttackRelease(note.pitch, note.duration);
      });
      event.start(adjustedTime);
      events.push(event);
    });

    // Schedule stop after last note
    if (notes.length > 0) {
      const lastNote = notes[notes.length - 1];
      const lastTime = lastNote.time * tempoRatio;
      const endEvent = new Tone.ToneEvent(() => {
        setIsPlaying(false);
        setCurrentNoteIndex(-1);
        transport.stop();
      });
      endEvent.start(lastTime + 1);
      events.push(endEvent);
    }

    eventsRef.current = events;
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
