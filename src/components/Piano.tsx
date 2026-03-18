import { useEffect, useCallback, useState } from "react";
import { isBlackKey, midiToNote } from "../utils/music";
import { keyToMidi, midiToKeyLabel } from "../utils/keyboard-map";

interface PianoProps {
  lowMidi: number;
  highMidi: number;
  onNotePlay: (pitch: string, midi: number) => void;
  highlightedMidi?: number | null;
}

export function Piano({
  lowMidi,
  highMidi,
  onNotePlay,
  highlightedMidi,
}: PianoProps) {
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  const [octaveShift, setOctaveShift] = useState(0);

  // Anchor keyboard to the piano's low C, shifted by octave offset
  const anchorC = lowMidi + octaveShift * 12;

  // Clamp octave shift so keyboard stays within piano range
  const canShiftUp = anchorC + 12 <= highMidi;
  const canShiftDown = anchorC - 12 >= lowMidi;

  const allMidis: number[] = [];
  for (let m = lowMidi; m <= highMidi; m++) {
    allMidis.push(m);
  }

  const whiteMidis = allMidis.filter(m => !isBlackKey(m));
  const blackMidis = allMidis.filter(m => isBlackKey(m));

  const handlePlay = useCallback(
    (midi: number) => {
      const pitch = midiToNote(midi);
      onNotePlay(pitch, midi);
    },
    [onNotePlay],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      // +/= to shift octave up, - to shift down
      if (e.key === "=" || e.key === "+") {
        setOctaveShift(prev => {
          const next = prev + 1;
          return lowMidi + next * 12 <= highMidi ? next : prev;
        });
        return;
      }
      if (e.key === "-") {
        setOctaveShift(prev => {
          const next = prev - 1;
          return lowMidi + next * 12 >= lowMidi ? next : prev;
        });
        return;
      }

      const midi = keyToMidi(e.key, anchorC);
      if (midi !== null && midi >= lowMidi && midi <= highMidi) {
        setActiveKeys(prev => new Set(prev).add(midi));
        handlePlay(midi);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const midi = keyToMidi(e.key, anchorC);
      if (midi !== null) {
        setActiveKeys(prev => {
          const next = new Set(prev);
          next.delete(midi);
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [anchorC, lowMidi, highMidi, handlePlay]);

  // Figure out which octave label the keyboard is currently on
  const currentOctave = Math.floor(anchorC / 12) - 1;

  const getWhiteKeyStyle = (midi: number): string => {
    const base = "relative h-36 sm:h-44 border border-gray-300 rounded-b cursor-pointer select-none transition-colors duration-100 flex flex-col justify-end items-center pb-2";
    if (highlightedMidi === midi) return `${base} bg-blue-200`;
    if (activeKeys.has(midi)) return `${base} bg-gray-200`;
    return `${base} bg-white hover:bg-gray-50`;
  };

  const getBlackKeyStyle = (midi: number): string => {
    const base = "absolute top-0 rounded-b z-10 cursor-pointer select-none transition-colors duration-100 flex flex-col justify-end items-center pb-1";
    if (highlightedMidi === midi) return `${base} bg-blue-500`;
    if (activeKeys.has(midi)) return `${base} bg-gray-600`;
    return `${base} bg-gray-900 hover:bg-gray-700 text-white`;
  };

  const getBlackKeyPosition = (midi: number): number | null => {
    const prevWhite = midi - 1;
    const whiteIndex = whiteMidis.indexOf(prevWhite);
    if (whiteIndex === -1) return null;
    return whiteIndex;
  };

  const whiteKeyWidth = `${100 / whiteMidis.length}%`;

  return (
    <div className="w-full bg-gray-100 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200">
      {/* Octave shift controls */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={() => canShiftDown && setOctaveShift(s => s - 1)}
          disabled={!canShiftDown}
          className="px-3 py-1 text-lg font-bold bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          &minus;
        </button>
        <span className="text-sm text-gray-600 font-mono">
          Octave C{currentOctave}
        </span>
        <button
          onClick={() => canShiftUp && setOctaveShift(s => s + 1)}
          disabled={!canShiftUp}
          className="px-3 py-1 text-lg font-bold bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      <div className="relative" style={{ height: "clamp(144px, 20vw, 176px)" }}>
        <div className="flex h-full">
          {whiteMidis.map(midi => {
            const label = midiToKeyLabel(midi, anchorC);
            return (
              <div
                key={midi}
                className={getWhiteKeyStyle(midi)}
                style={{ width: whiteKeyWidth }}
                onMouseDown={() => handlePlay(midi)}
              >
                {label && (
                  <span className="text-[10px] sm:text-xs text-gray-400 font-mono hidden sm:block">
                    {label}
                  </span>
                )}
                <span className="text-[9px] text-gray-300">
                  {midiToNote(midi)}
                </span>
              </div>
            );
          })}
        </div>

        {blackMidis.map(midi => {
          const whiteIndex = getBlackKeyPosition(midi);
          if (whiteIndex === null) return null;

          const leftPercent = ((whiteIndex + 0.65) / whiteMidis.length) * 100;
          const widthPercent = (0.7 / whiteMidis.length) * 100;
          const label = midiToKeyLabel(midi, anchorC);

          return (
            <div
              key={midi}
              className={getBlackKeyStyle(midi)}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                height: "60%",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handlePlay(midi);
              }}
            >
              {label && (
                <span className="text-[9px] font-mono opacity-70 hidden sm:block">
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-center text-xs text-gray-400 hidden sm:block">
        Type on your keyboard to play the notes
      </div>
    </div>
  );
}
