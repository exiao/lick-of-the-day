import { memo } from "react";
import type { CuratedLick } from "../utils/curated-licks";

export interface StudioSet {
  id: string;
  title: string;
  blurb: string;
  licks: CuratedLick[];
}

interface PathwayProps {
  sets: StudioSet[];
  activeId: string;
  isDaily: boolean;
  disabled: boolean;
  onSelect: (c: CuratedLick) => void;
  onToday: () => void;
}

// The studio sets: hand-written phrases in order of difficulty, plus a way back
// to today's generated lick (at the head of the first set).
export const Pathway = memo(function Pathway({ sets, activeId, isDaily, disabled, onSelect, onToday }: PathwayProps) {
  return (
    <div className="space-y-8">
      {sets.map((set, setIndex) => (
        <section key={set.id} aria-labelledby={`pathway-${set.id}`} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
            <h2 id={`pathway-${set.id}`} className="text-lg font-semibold">{set.title}</h2>
            <p className="panel-label">{set.blurb}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {setIndex === 0 && (
              <button
                type="button"
                className="cap flex-col !items-start !justify-start gap-1.5 p-4 text-left"
                aria-pressed={isDaily}
                onClick={onToday}
                disabled={disabled}
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="led" aria-hidden="true" /> Today
                </span>
                <span className="text-base font-semibold">Lick of the Day</span>
                <span className="panel-label font-normal leading-snug">A fresh generated lick, shared by everyone today.</span>
              </button>
            )}
            {set.licks.map(c => (
              <button
                key={c.lick.id}
                type="button"
                className={`cap flex-col !items-start !justify-start gap-1.5 p-4 text-left${c.kind === "tune" ? " sm:col-span-2" : ""}`}
                aria-pressed={activeId === c.lick.id}
                onClick={() => onSelect(c)}
                disabled={disabled}
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="led" aria-hidden="true" /> Level {c.level}
                  <span className="panel-label font-normal">
                    {c.kind === "tune" ? "Tune" : "Lick"} · <span className="num">{c.lick.bars}</span> bars ·{" "}
                    <span className="num">{c.practiceTempo}→{c.lick.tempo}</span> bpm
                  </span>
                </span>
                <span className="text-base font-semibold">{c.lick.title}</span>
                <span className="chart-type text-sm" style={{ color: "var(--ink-soft)" }}>
                  {uniqueChords(c).join("  ")}
                </span>
                <span className="panel-label font-normal leading-snug">{c.focus}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});

function uniqueChords(c: CuratedLick): string[] {
  const seen: string[] = [];
  for (const ch of c.lick.chords) if (seen[seen.length - 1] !== ch.chord) seen.push(ch.chord);
  return seen;
}
