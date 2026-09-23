import { useState, useCallback, useMemo } from "react";
import type { Note } from "../types/lick";
import { pitchesMatch } from "../utils/music";

interface UsePracticeModeReturn {
  /** Position within the pitched (non-rest) notes. */
  currentIndex: number;
  /** Index into the full notes array (rests included) of the expected note, or -1. */
  currentNoteIndex: number;
  score: number;
  misses: number;
  total: number;
  isComplete: boolean;
  showHint: boolean;
  lastResult: "correct" | "incorrect" | null;
  expectedPitch: string | null;
  checkNote: (pitch: string) => "correct" | "incorrect";
  toggleHint: () => void;
  restart: () => void;
}

export function usePracticeMode(notes: Note[]): UsePracticeModeReturn {
  // Rests are played as silence, so practice steps only through pitched notes.
  const pitched = useMemo(
    () => notes.flatMap((n, i) => (n.pitch === "rest" ? [] : [i])),
    [notes],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [lastResult, setLastResult] = useState<"correct" | "incorrect" | null>(null);

  // Start over whenever a different lick arrives (adjust-state-during-render).
  const [trackedNotes, setTrackedNotes] = useState(notes);
  if (trackedNotes !== notes) {
    setTrackedNotes(notes);
    setCurrentIndex(0);
    setScore(0);
    setMisses(0);
    setLastResult(null);
  }

  const isComplete = currentIndex >= pitched.length;
  const currentNoteIndex = isComplete ? -1 : pitched[currentIndex];
  const expectedPitch = isComplete ? null : notes[currentNoteIndex].pitch;

  const checkNote = useCallback(
    (pitch: string): "correct" | "incorrect" => {
      if (expectedPitch === null) return "incorrect";
      if (pitchesMatch(pitch, expectedPitch)) {
        setScore(s => s + 1);
        setCurrentIndex(i => i + 1);
        setLastResult("correct");
        return "correct";
      }
      setMisses(m => m + 1);
      setLastResult("incorrect");
      return "incorrect";
    },
    [expectedPitch],
  );

  const toggleHint = useCallback(() => setShowHint(h => !h), []);

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setScore(0);
    setMisses(0);
    setLastResult(null);
  }, []);

  return {
    currentIndex,
    currentNoteIndex,
    score,
    misses,
    total: pitched.length,
    isComplete,
    showHint,
    lastResult,
    expectedPitch,
    checkNote,
    toggleHint,
    restart,
  };
}
