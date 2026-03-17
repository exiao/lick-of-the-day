import { useEffect, useCallback, useState } from "react";
import { isBlackKey, midiToNote } from "../utils/music";
import { keyToMidi, midiToKeyLabel } from "../utils/keyboard-map";

interface PianoProps {
  lowMidi: number;
  highMidi: number;
  onNotePlay: (pitch: string, midi: number) => void;
  highlightedMidi?: number | null;  // current note in listen mode
  expectedMidi?: number | null;     // expected note in practice mode
  showHint?: boolean;
  lastResult?: "correct" | "incorrect" | null;
}

export function Piano({
  lowMidi,
  highMidi,
  onNotePlay,
  highlightedMidi,
  expectedMidi,
  showHint,
  lastResult,
}: PianoProps) {
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  const [flashMidi, setFlashMidi] = useState<{ midi: number; type: "correct" | "incorrect" } | null>(null);

  // Build list of all MIDI notes in range
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

      // Flash effect
      setFlashMidi({ midi, type: lastResult === "incorrect" ? "incorrect" : "correct" });
      setTimeout(() => setFlashMidi(null), 200);
    },
    [onNotePlay, lastResult],
  );

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const midi = keyToMidi(e.key, lowMidi);
      if (midi !== null && midi <= highMidi) {
        setActiveKeys(prev => new Set(prev).add(midi));
        handlePlay(midi);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const midi = keyToMidi(e.key, lowMidi);
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
  }, [lowMidi, highMidi, handlePlay]);

  const getWhiteKeyStyle = (midi: number): string => {
    const base = "relative h-36 sm:h-44 border border-gray-300 rounded-b cursor-pointer select-none transition-colors duration-100 flex flex-col justify-end items-center pb-2";
    if (flashMidi?.midi === midi) {
      return `${base} ${flashMidi.type === "correct" ? "bg-green-300" : "bg-red-300"}`;
    }
    if (highlightedMidi === midi) return `${base} bg-blue-200`;
    if (expectedMidi === midi && showHint) return `${base} bg-yellow-100`;
    if (activeKeys.has(midi)) return `${base} bg-gray-200`;
    return `${base} bg-white hover:bg-gray-50`;
  };

  const getBlackKeyStyle = (midi: number): string => {
    const base = "absolute top-0 w-[60%] h-24 sm:h-28 rounded-b z-10 cursor-pointer select-none transition-colors duration-100 flex flex-col justify-end items-center pb-1";
    if (flashMidi?.midi === midi) {
      return `${base} ${flashMidi.type === "correct" ? "bg-green-500" : "bg-red-500"}`;
    }
    if (highlightedMidi === midi) return `${base} bg-blue-500`;
    if (expectedMidi === midi && showHint) return `${base} bg-yellow-400 text-black`;
    if (activeKeys.has(midi)) return `${base} bg-gray-600`;
    return `${base} bg-gray-900 hover:bg-gray-700 text-white`;
  };

  // Calculate black key position relative to white keys
  const getBlackKeyPosition = (midi: number): number | null => {
    // Find the white key just below this black key
    const prevWhite = midi - 1;
    const whiteIndex = whiteMidis.indexOf(prevWhite);
    if (whiteIndex === -1) return null;
    return whiteIndex;
  };

  const whiteKeyWidth = `${100 / whiteMidis.length}%`;

  return (
    <div className="w-full bg-gray-100 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200">
      <div className="relative" style={{ height: "clamp(144px, 20vw, 176px)" }}>
        {/* White keys */}
        <div className="flex h-full">
          {whiteMidis.map(midi => {
            const label = midiToKeyLabel(midi, lowMidi);
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

        {/* Black keys */}
        {blackMidis.map(midi => {
          const whiteIndex = getBlackKeyPosition(midi);
          if (whiteIndex === null) return null;

          const leftPercent = ((whiteIndex + 0.65) / whiteMidis.length) * 100;
          const widthPercent = (0.7 / whiteMidis.length) * 100;
          const label = midiToKeyLabel(midi, lowMidi);

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
        Keyboard: A-K = white keys, W/E/T/Y/U = sharps/flats | Z-M = upper octave
      </div>
    </div>
  );
}
