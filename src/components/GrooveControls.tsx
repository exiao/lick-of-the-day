import { memo } from "react";
import { GROOVE_STYLES, type GrooveStyle } from "../audio/groove";

interface GrooveControlsProps {
  style: GrooveStyle;
  onStyleChange: (style: GrooveStyle) => void;
  drumsEnabled: boolean;
  onDrumsToggle: (enabled: boolean) => void;
  bassEnabled: boolean;
  onBassToggle: (enabled: boolean) => void;
}

// The rhythm section: which groove the drums and bass play, and whether each is in.
export const GrooveControls = memo(function GrooveControls({
  style, onStyleChange, drumsEnabled, onDrumsToggle, bassEnabled, onBassToggle,
}: GrooveControlsProps) {
  const current = GROOVE_STYLES.find(g => g.value === style);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-between">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="panel-label">Groove</span>
        <div className="well-sm inline-flex gap-1 p-1.5" role="radiogroup" aria-label="Groove">
          {GROOVE_STYLES.map(g => (
            <button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={style === g.value}
              onClick={() => onStyleChange(g.value)}
              className="cap h-9 px-3.5"
              title={g.hint}
              style={style === g.value ? { color: "var(--cobalt)" } : { boxShadow: "none", background: "transparent" }}
            >
              {g.label}
            </button>
          ))}
        </div>
        {current && <span className="panel-label hidden md:inline">{current.hint}</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <button type="button" className="cap h-10 px-3.5" aria-pressed={drumsEnabled} onClick={() => onDrumsToggle(!drumsEnabled)} title="Kick, snare and hats">
          <span className="led" aria-hidden="true" /> Drums
        </button>
        <button type="button" className="cap h-10 px-3.5" aria-pressed={bassEnabled} onClick={() => onBassToggle(!bassEnabled)} title="Bass line that follows the chord changes">
          <span className="led" aria-hidden="true" /> Bass
        </button>
      </div>
    </div>
  );
});
