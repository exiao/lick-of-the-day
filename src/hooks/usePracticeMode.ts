import { useState, useCallback } from "react";
import type { Note } from "../types/lick";
import { pitchesMatch } from "../utils/music";

interface UsePracticeModeReturn {
  currentIndex: number;
  score: number;
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "incorrect" | null>(null);

  const isComplete = currentIndex >= notes.length;
  const expectedPitch = isComplete ? null : notes[currentIndex].pitch;

  const checkNote = useCallback(
    (pitch: string): "correct" | "incorrect" => {
      if (isComplete) return "incorrect";

      const expected = notes[currentIndex].pitch;
      if (pitchesMatch(pitch, expected)) {
        setScore(s => s + 1);
        setCurrentIndex(i => i + 1);
        setLastResult("correct");
        return "correct";
      } else {
        setLastResult("incorrect");
        return "incorrect";
      }
    },
    [currentIndex, notes, isComplete],
  );

  const toggleHint = useCallback(() => setShowHint(h => !h), []);

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setScore(0);
    setLastResult(null);
  }, []);

  return {
    currentIndex,
    score,
    total: notes.length,
    isComplete,
    showHint,
    lastResult,
    expectedPitch,
    checkNote,
    toggleHint,
    restart,
  };
}
