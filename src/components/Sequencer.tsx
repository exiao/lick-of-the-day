import { memo, useSyncExternalStore, type KeyboardEvent } from "react";
import type { Chord } from "../types/lick";
import type { StepStore } from "../hooks/usePlayback";
import { noteAtStep, type Grid } from "../sequencer/grid";

interface SequencerProps {
  /** The lick on a 16th-note grid, or null when its rhythm is off the grid. */
  grid: Grid | null;
  chords: Chord[];
  beatsPerBar: number;
  armed: number | null;
  editable: boolean;
  edited: boolean;
  /** Step of the practice target (practice mode), if any. */
  target: number | null;
  steps: StepStore;
  onPad: (step: number) => void;
  onNudge: (step: number, semitones: number) => void;
  onClear: (step: number) => void;
  onRevert: () => void;
}

const pretty = (pitch: string) => {
  const m = /^([A-G])([#b]?)(\d)$/.exec(pitch);
  if (!m) return { name: pitch, octave: "" };
  return { name: m[1] + (m[2] === "#" ? "♯" : m[2] === "b" ? "♭" : ""), octave: m[3] };
};

// The lick as a tactile 16-step-per-bar sequencer. Lit pads are note onsets;
// the pads a note sustains through show its tail. Edits go through the grid
// model, which rewrites the notes and the notation together.
export const Sequencer = memo(function Sequencer({
  grid, chords, beatsPerBar, armed, editable, edited, target, steps, onPad, onNudge, onClear, onRevert,
}: SequencerProps) {
  const now = useSyncExternalStore(steps.subscribe, steps.get);

  if (!grid) {
    return (
      <section className="well px-4 py-4 sm:px-5" aria-labelledby="seq-heading">
        <h2 id="seq-heading" className="text-sm font-semibold">Step sequencer</h2>
        <p className="panel-label mt-1">This lick uses rhythms finer than a 16th note, so it can't be shown on the step grid.</p>
      </section>
    );
  }

  const stepsPerBeat = 4;
  const bars = Math.round(grid.totalSteps / grid.stepsPerBar);
  const chordAt = new Map<number, string>();
  for (const c of chords) chordAt.set(((c.bar - 1) * beatsPerBar + (c.beat - 1)) * stepsPerBeat, c.chord);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, step: number, isOnset: boolean) => {
    if (!editable || !isOnset) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      onNudge(step, (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 12 : 1));
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onClear(step);
    }
  };

  const armedNote = armed !== null ? noteAtStep(grid, armed) : null;

  return (
    <section className="well px-3 py-4 sm:px-5 sm:py-5 space-y-3" aria-labelledby="seq-heading">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
        <div className="flex items-baseline gap-3">
          <h2 id="seq-heading" className="text-sm font-semibold">Step sequencer</h2>
          <span className="panel-label">
            {editable
              ? armedNote?.isOnset
                ? `Selected ${armedNote.note.pitch}: play a key or use ↑ ↓ to change it, tap again to clear.`
                : "Tap a pad to add a note, tap a lit pad to select it."
              : "Switch to Listen to edit."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {armedNote?.isOnset && editable && (
            <>
              <button type="button" className="cap h-8 w-9" aria-label="Pitch down a semitone" onClick={() => onNudge(armed!, -1)}>↓</button>
              <button type="button" className="cap h-8 w-9" aria-label="Pitch up a semitone" onClick={() => onNudge(armed!, 1)}>↑</button>
            </>
          )}
          {edited && (
            <button type="button" className="cap h-8 px-3" onClick={onRevert}>
              Revert edits
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: bars }, (_, bar) => (
          <div key={bar} className="seq-bar" role="group" aria-label={`Bar ${bar + 1}`}>
            {Array.from({ length: grid.stepsPerBar / stepsPerBeat }, (_, beat) => (
              <div key={beat} className="seq-group">
                {Array.from({ length: stepsPerBeat }, (_, i) => {
                  const step = bar * grid.stepsPerBar + beat * stepsPerBeat + i;
                  const hit = noteAtStep(grid, step);
                  const isOnset = !!hit?.isOnset;
                  const tail = hit && !hit.isOnset;
                  const chord = chordAt.get(step);
                  const label = isOnset ? pretty(hit!.note.pitch) : null;
                  const pos = `bar ${bar + 1} beat ${beat + 1}${i ? ` ${["", "e", "and", "a"][i]}` : ""}`;
                  return (
                    <div key={step} className="seq-cell">
                      <span className="seq-chord chart-type" aria-hidden="true">{chord ?? ""}</span>
                      <button
                        type="button"
                        className="seq-pad"
                        data-on={isOnset || undefined}
                        data-tail={tail || undefined}
                        data-tail-end={tail && hit!.note.step + hit!.note.length - 1 === step ? true : undefined}
                        data-now={now === step || undefined}
                        data-armed={armed === step && isOnset ? true : undefined}
                        data-target={target === step || undefined}
                        data-accent={isOnset && (hit!.note.velocity ?? 0.7) >= 0.85 ? true : undefined}
                        data-ghost={isOnset && (hit!.note.articulation === "ghost" || (hit!.note.velocity ?? 0.7) <= 0.4) ? true : undefined}
                        disabled={!editable}
                        aria-pressed={isOnset}
                        aria-label={isOnset ? `${hit!.note.pitch} at ${pos}` : tail ? `${hit!.note.pitch} held, ${pos}` : `Empty, ${pos}`}
                        onClick={() => onPad(step)}
                        onKeyDown={(e) => onKey(e, step, isOnset)}
                      >
                        <span className="seq-led" aria-hidden="true" />
                        {label && (
                          <span className="seq-note num" aria-hidden="true">
                            {label.name}<small>{label.octave}</small>
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
});
