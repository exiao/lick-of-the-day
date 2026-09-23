import { useEffect, useRef } from "react";
import abcjs from "abcjs";

interface SheetMusicProps {
  abc: string;
  currentNoteIndex: number;
  /** Practice mode: notes before this index are marked done, this one is the target. */
  completedNotes?: number;
  /** Small screens: wrap to two bars per line so the staff stays readable. */
  narrow?: boolean;
}

export function SheetMusic({ abc, currentNoteIndex, completedNotes, narrow = false }: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      abcjs.renderAbc(containerRef.current, abc, {
        responsive: "resize",
        // Needed for the .abcjs-note / .abcjs-rest classes the highlight uses.
        add_classes: true,
        jazzchords: true,
        staffwidth: narrow ? 380 : 640,
        wrap: narrow ? { minSpacing: 1, maxSpacing: 3, preferredMeasuresPerLine: 2 } : undefined,
        format: { gchordfont: "Palatino Italic 15" },
        paddingtop: 10,
        paddingbottom: 10,
        paddingleft: 0,
        paddingright: 0,
      });
    } catch (err) {
      // Malformed ABC from generation must not take the whole instrument down.
      console.warn("[sheet-music] could not render ABC:", err);
      containerRef.current.textContent = "This lick's notation could not be drawn, but it still plays.";
    }
  }, [abc, narrow]);

  // Highlight by position among notes AND rests, so indices line up with the
  // notes array (which includes rests).
  useEffect(() => {
    if (!containerRef.current) return;
    const els = containerRef.current.querySelectorAll(".abcjs-note, .abcjs-rest");
    els.forEach((el, i) => {
      el.classList.remove("playing", "completed", "target");
      if (completedNotes !== undefined) {
        if (i === currentNoteIndex) el.classList.add("target");
        else if (i < completedNotes) el.classList.add("completed");
      } else if (i === currentNoteIndex) {
        el.classList.add("playing");
      }
    });
  }, [abc, narrow, currentNoteIndex, completedNotes]);

  return (
    <div className="paper px-3 py-2 sm:px-5 sm:py-3">
      <div ref={containerRef} className="sheet-music-container" />
    </div>
  );
}
