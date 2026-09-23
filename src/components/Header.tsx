import { memo } from "react";
import { GENRES } from "../types/lick";

interface HeaderProps {
  onNewLick: () => void;
  loading: boolean;
  lickTitle: string;
  lickKey: string;
  lickGenre: string;
  /** Overrides the "Lick of the Day" eyebrow, e.g. for studio-set items. */
  eyebrow?: string;
  isDaily: boolean;
  tempo: number;
}

// Memoized: none of its props change while a lick plays, so it should not
// re-commit on every currentNoteIndex tick (measured 16 wasted commits over a
// 15-note sweep before this).
export const Header = memo(function Header({
  onNewLick,
  loading,
  lickTitle,
  lickKey,
  lickGenre,
  eyebrow,
  isDaily,
  tempo,
}: HeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const genreLabel = GENRES.find(g => g.value === lickGenre)?.label ?? lickGenre;

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="panel-label">{eyebrow ?? (isDaily ? `Lick of the Day for ${today}` : "Lick of the Day")}</p>
        <h1 className="chart-type text-3xl sm:text-4xl leading-tight mt-1 truncate">{lickTitle}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
          {genreLabel} in {lickKey}, written at <span className="num">{tempo}</span> bpm
        </p>
      </div>

      <button type="button" onClick={onNewLick} disabled={loading} className="cap h-11 px-5">
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className={loading ? "animate-spin" : ""}>
          <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2v3.2h-3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {loading ? "Writing a lick" : "Generate new lick"}
      </button>
    </header>
  );
});
