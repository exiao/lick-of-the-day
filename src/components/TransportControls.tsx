import { memo } from "react";
import { Knob } from "./Knob";

interface TransportControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  tempo: number;
  /** The lick's written tempo: the knob's reset point. */
  originalTempo: number;
  onTempoChange: (bpm: number) => void;
  swing: number;
  originalSwing: number;
  onSwingChange: (amount: number) => void;
  loopEnabled: boolean;
  onLoopToggle: (enabled: boolean) => void;
  clickEnabled: boolean;
  onClickToggle: (enabled: boolean) => void;
  /** Disable Play while notes are still streaming in. */
  playDisabled?: boolean;
}

function Toggle({ label, pressed, onToggle, hint }: { label: string; pressed: boolean; onToggle: (v: boolean) => void; hint: string }) {
  return (
    <button type="button" className="cap h-11 px-1.5 md:px-3.5" aria-pressed={pressed} onClick={() => onToggle(!pressed)} title={hint}>
      <span className="led" aria-hidden="true" />
      {label}
    </button>
  );
}

// Memoized: its props are stable across a playback sweep (isPlaying/tempo only
// change on explicit transport actions), so it should not re-commit on every
// currentNoteIndex tick.
export const TransportControls = memo(function TransportControls({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  tempo,
  originalTempo,
  onTempoChange,
  swing,
  originalSwing,
  onSwingChange,
  loopEnabled,
  onLoopToggle,
  clickEnabled,
  onClickToggle,
  playDisabled = false,
}: TransportControlsProps) {
  return (
    <div className="grid grid-cols-2 items-center gap-x-4 gap-y-3 md:flex md:justify-between md:gap-6">
      <div className="well-sm col-start-1 row-start-1 flex items-center gap-2 p-1.5 md:p-2.5">
        <button
          type="button"
          className="cap cap-primary h-11 min-w-0 flex-1 md:h-14 md:w-24 md:flex-none"
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isPlaying && playDisabled}
          aria-label={isPlaying ? "Pause" : "Play"}
          title="Space"
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.2v11.6a.8.8 0 0 0 1.2.7l9.4-5.8a.8.8 0 0 0 0-1.4L5.2 1.5A.8.8 0 0 0 4 2.2z" fill="currentColor" /></svg>
          )}
          {playDisabled && !isPlaying ? "Wait" : isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" className="cap h-11 w-11 shrink-0 md:h-14 md:w-14" onClick={onStop} aria-label="Stop">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor" /></svg>
        </button>
      </div>

      <div className="transport-knobs col-start-2 row-span-2 row-start-1 flex items-start justify-between gap-2 md:gap-7">
        <Knob
          label="Tempo"
          value={tempo}
          min={40}
          max={240}
          defaultValue={originalTempo}
          onChange={onTempoChange}
          format={v => `${v} bpm`}
        />
        <Knob
          label="Swing"
          value={Math.round(swing * 100)}
          min={0}
          max={100}
          defaultValue={Math.round(originalSwing * 100)}
          onChange={v => onSwingChange(v / 100)}
          format={v => (v === 0 ? "Straight" : `${v}%`)}
        />
      </div>

      <div className="col-start-1 row-start-2 grid grid-cols-2 gap-2 md:gap-2.5">
        <Toggle label="Loop" pressed={loopEnabled} onToggle={onLoopToggle} hint="Repeat the lick" />
        <Toggle label="Click" pressed={clickEnabled} onToggle={onClickToggle} hint="Metronome on every beat" />
      </div>
    </div>
  );
});
