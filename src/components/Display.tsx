import type { Chord } from "../types/lick";
import { chordToneNames, degreeOver } from "../utils/chords";

interface DisplayProps {
  chords: Chord[];
  bars: number;
  beatsPerBar: number;
  /** Beat position the display is describing (playhead, practice target, or 0). */
  beat: number;
  /** Beat LEDs only pulse while the transport runs. */
  pulsing: boolean;
  activeChordIndex: number;
  /** The note being described: sounding in playback, or expected in practice. */
  note: { name: string; midi: number } | null;
  mode: "listen" | "practice";
  practice?: { step: number; total: number; misses: number; complete: boolean; result: "correct" | "incorrect" | null };
}

// Readable names for chord-function labels.
const DEGREE_WORDS: Record<string, string> = {
  R: "the root", "3": "the 3rd", b3: "the minor 3rd", "5": "the 5th", "7": "the major 7th",
  b7: "the 7th", "6": "the 6th", "13": "the 13th", "9": "the 9th", b9: "the b9",
  "#9": "the #9", "11": "the 11th", b5: "the b5", "#5": "the #5", b13: "the b13",
};

function describe(chord: string | undefined, midi: number | undefined) {
  if (!chord || midi === undefined) return null;
  const d = degreeOver(chord, midi);
  return d ? DEGREE_WORDS[d] ?? d : null;
}

export function Display({ chords, bars, beatsPerBar, beat, pulsing, activeChordIndex, note, mode, practice }: DisplayProps) {
  const active = chords[activeChordIndex];
  const next = chords[activeChordIndex + 1] ?? (chords.length > 1 ? chords[0] : undefined);
  const barIndex = Math.min(bars - 1, Math.floor(Math.max(0, beat) / beatsPerBar));
  const beatInBar = Math.floor(Math.max(0, beat)) % beatsPerBar;
  const fn = describe(active?.chord, note?.midi);
  const noteName = note?.name.replace(/\d+$/, "");

  let readout: string;
  if (mode === "practice" && practice) {
    if (practice.complete) {
      readout = practice.misses === 0
        ? `Clean run: all ${practice.total} notes, no misses.`
        : `Done: ${practice.total} notes, ${practice.misses} miss${practice.misses === 1 ? "" : "es"}. Restart for a clean run.`;
    } else if (note) {
      readout = `Play ${noteName}${fn ? `, ${fn} of ${active?.chord}` : ""}.`;
    } else {
      readout = "Play the first note.";
    }
  } else if (note) {
    readout = `${noteName}${fn ? ` is ${fn} of ${active?.chord}` : ""}`;
  } else {
    readout = "Press Play, or play the keys yourself.";
  }

  return (
    <div className="screen px-4 py-4 sm:px-6 sm:py-5">
      <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-4 items-start">
        <div className="min-w-0">
          <div className="flex items-baseline gap-4 flex-wrap">
            <span className="chart-type text-5xl sm:text-6xl leading-none tracking-tight" aria-live="polite">
              {active?.chord ?? "—"}
            </span>
            {next && next !== active && (
              <span className="text-sm" style={{ color: "var(--screen-dim)" }}>
                then <span className="chart-type text-lg" style={{ color: "var(--screen-ink)" }}>{next.chord}</span>
              </span>
            )}
          </div>
          {active && (
            <p className="mt-2 text-sm" style={{ color: "var(--screen-dim)" }}>
              Chord tones{" "}
              <span className="font-semibold tracking-wide" style={{ color: "#e6c47a" }}>
                {chordToneNames(active.chord).join("  ")}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2" aria-hidden="true">
            {Array.from({ length: beatsPerBar }, (_, i) => (
              <span
                key={i}
                className="beat-led"
                data-downbeat={i === 0}
                data-on={pulsing && beat >= 0 && i === beatInBar}
              />
            ))}
          </div>
          <span className="num text-xs" style={{ color: "var(--screen-dim)" }}>
            Bar {barIndex + 1} of {bars}
          </span>
        </div>

        <p
          className="col-span-2 text-base sm:text-lg min-h-[1.75rem]"
          style={{ color: practice?.result === "incorrect" && mode === "practice" ? "#ff9b8f" : "var(--screen-ink)" }}
          aria-live="polite"
        >
          {readout}
          {mode === "practice" && practice && !practice.complete && (
            <span className="num ml-3 text-sm" style={{ color: "var(--screen-dim)" }}>
              {practice.step + 1}/{practice.total}
              {practice.misses > 0 && `, ${practice.misses} missed`}
            </span>
          )}
        </p>
      </div>

      {/* Chord lane: one cell per bar, chords placed at their beat */}
      <div className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${bars}, minmax(0, 1fr))` }}>
        {Array.from({ length: bars }, (_, b) => (
          <div key={b} className="lane-cell relative h-9" data-active={barIndex === b && beat >= 0}>
            {chords.map((c, i) =>
              c.bar === b + 1 ? (
                <span
                  key={i}
                  className="chart-type absolute top-1/2 -translate-y-1/2 text-sm sm:text-base whitespace-nowrap"
                  style={{
                    left: `calc(${((c.beat - 1) / beatsPerBar) * 100}% + 8px)`,
                    color: i === activeChordIndex ? "#ffffff" : "var(--screen-dim)",
                  }}
                >
                  {c.chord}
                </span>
              ) : null,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
