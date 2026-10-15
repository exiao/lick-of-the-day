import { memo } from "react";
import { GROOVE_STYLES, type GrooveStyle } from "../audio/groove";

interface GrooveControlsProps {
  style: GrooveStyle;
  onStyleChange: (style: GrooveStyle) => void;
  drumsEnabled: boolean;
  onDrumsToggle: (enabled: boolean) => void;
  bassEnabled: boolean;
  onBassToggle: (enabled: boolean) => void;
  chordsEnabled: boolean;
  onChordsToggle: (enabled: boolean) => void;
}

// Accompaniment layers and the groove played by the drums and bass.
export const GrooveControls = memo(function GrooveControls({
  style, onStyleChange, drumsEnabled, onDrumsToggle, bassEnabled, onBassToggle,
  chordsEnabled, onChordsToggle,
}: GrooveControlsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:items-end sm:gap-6">
      <div className="min-w-0">
        <span className="panel-label mb-2 block">Groove</span>
        <div className="well-sm grid grid-cols-3 gap-1 p-1.5" role="radiogroup" aria-label="Groove">
          {GROOVE_STYLES.map(g => (
            <button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={style === g.value}
              onClick={() => onStyleChange(g.value)}
              className="cap h-11 min-w-0 px-2"
              title={g.hint}
              style={style === g.value ? { color: "var(--cobalt)" } : { boxShadow: "none", background: "transparent" }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:pb-1.5" role="group" aria-label="Accompaniment">
        <button type="button" className="cap h-11 min-w-0 px-2" aria-pressed={drumsEnabled} onClick={() => onDrumsToggle(!drumsEnabled)} title="Kick, snare and hats">
          <span className="led" aria-hidden="true" /> Drums
        </button>
        <button type="button" className="cap h-11 min-w-0 px-2" aria-pressed={bassEnabled} onClick={() => onBassToggle(!bassEnabled)} title="Bass line that follows the chord changes">
          <span className="led" aria-hidden="true" /> Bass
        </button>
        <button type="button" className="cap h-11 min-w-0 px-2" aria-pressed={chordsEnabled} onClick={() => onChordsToggle(!chordsEnabled)} title="Piano chords underneath the melody">
          <span className="led" aria-hidden="true" /> Comp
        </button>
      </div>
    </div>
  );
});
