import { useEffect, useRef } from "react";
import abcjs from "abcjs";

interface SheetMusicProps {
  abc: string;
  currentNoteIndex: number;
  completedNotes?: number; // for practice mode
}

export function SheetMusic({ abc, currentNoteIndex, completedNotes }: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tuneRef = useRef<abcjs.TuneObject[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    tuneRef.current = abcjs.renderAbc(containerRef.current, abc, {
      responsive: "resize",
      staffwidth: 600,
      paddingtop: 10,
      paddingbottom: 10,
    });
  }, [abc]);

  // Highlight current note during playback
  useEffect(() => {
    if (!containerRef.current) return;
    const notes = containerRef.current.querySelectorAll(".abcjs-note");

    notes.forEach((note, i) => {
      note.classList.remove("playing", "completed");
      if (i === currentNoteIndex) {
        note.classList.add("playing");
      } else if (completedNotes !== undefined && i < completedNotes) {
        note.classList.add("completed");
      }
    });
  }, [currentNoteIndex, completedNotes]);

  return (
    <div className="w-full bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <div ref={containerRef} className="sheet-music-container" />
      <style>{`
        .sheet-music-container svg {
          width: 100%;
          max-width: 100%;
        }
        .abcjs-note.playing path,
        .abcjs-note.playing circle {
          fill: #3b82f6 !important;
        }
        .abcjs-note.completed path,
        .abcjs-note.completed circle {
          fill: #22c55e !important;
        }
      `}</style>
    </div>
  );
}
