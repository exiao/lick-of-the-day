import { memo, useEffect, useRef, useState, useCallback } from "react";
import { isBlackKey, midiToNote } from "../utils/music";
import { keyToMidi, midiToKeyLabel } from "../utils/keyboard-map";

interface PianoProps {
  lowMidi: number;
  highMidi: number;
  onNoteOn: (pitch: string, midi: number) => void;
  onNoteOff: (pitch: string, midi: number) => void;
  /** Note currently sounding in playback. */
  highlightedMidi?: number | null;
  /** Pitch classes (0-11) of the active chord, marked with a brass tick. */
  chordTones?: number[];
  /** Practice: the key to play next. */
  targetMidi?: number | null;
  /** Practice: brief hit/miss flash on a key. `id` retriggers repeated flashes. */
  flash?: { midi: number; kind: "hit" | "miss"; id: number } | null;
}

export const Piano = memo(function Piano({
  lowMidi,
  highMidi,
  onNoteOn,
  onNoteOff,
  highlightedMidi,
  chordTones,
  targetMidi,
  flash,
}: PianoProps) {
  const [down, setDown] = useState<Set<number>>(new Set());
  const [octaveShift, setOctaveShift] = useState(0);
  const [visibleFlash, setVisibleFlash] = useState(flash ?? null);
  // pointerId -> midi currently held by that finger/mouse (multi-touch + glissando)
  const pointers = useRef(new Map<number, number>());
  // physical key code -> midi, so a release always stops the note it started
  const heldKeys = useRef(new Map<string, number>());

  // Clamp the shift whenever the range changes under us (new lick).
  const maxShift = Math.max(0, Math.floor((highMidi - lowMidi - 11) / 12));
  const shift = Math.min(octaveShift, maxShift);
  const anchorC = lowMidi + shift * 12;

  const press = useCallback((midi: number) => {
    setDown(prev => new Set(prev).add(midi));
    onNoteOn(midiToNote(midi), midi);
  }, [onNoteOn]);

  const release = useCallback((midi: number) => {
    setDown(prev => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
    onNoteOff(midiToNote(midi), midi);
  }, [onNoteOff]);

  // Flash fades after a moment; a new flash id restarts it.
  const [prevFlash, setPrevFlash] = useState(flash);
  if (flash !== prevFlash) {
    setPrevFlash(flash);
    setVisibleFlash(flash ?? null);
  }
  useEffect(() => {
    if (!visibleFlash) return;
    const t = window.setTimeout(() => setVisibleFlash(null), 380);
    return () => window.clearTimeout(t);
  }, [visibleFlash]);

  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "=" || e.key === "+" || e.key === "x") {
        setOctaveShift(s => Math.min(maxShift, Math.min(s, maxShift) + 1));
        return;
      }
      if (e.key === "-" || e.key === "z") {
        setOctaveShift(s => Math.max(0, Math.min(s, maxShift) - 1));
        return;
      }
      const midi = keyToMidi(e.key, anchorC);
      if (midi !== null && midi >= lowMidi && midi <= highMidi && !heldKeys.current.has(e.code)) {
        heldKeys.current.set(e.code, midi);
        press(midi);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const midi = heldKeys.current.get(e.code);
      if (midi === undefined) return;
      heldKeys.current.delete(e.code);
      release(midi);
    };
    const releaseAll = () => {
      for (const midi of heldKeys.current.values()) release(midi);
      heldKeys.current.clear();
      for (const midi of pointers.current.values()) release(midi);
      pointers.current.clear();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseAll);
    };
  }, [anchorC, lowMidi, highMidi, maxShift, press, release]);

  const midiAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-midi]");
    return el ? Number(el.dataset.midi) : null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const midi = midiAt(e.clientX, e.clientY);
    if (midi === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, midi);
    press(midi);
  };
  // Glissando: sliding across keys releases the old one and strikes the new one.
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const held = pointers.current.get(e.pointerId);
    if (held === undefined) return;
    const midi = midiAt(e.clientX, e.clientY);
    if (midi === null || midi === held) return;
    release(held);
    pointers.current.set(e.pointerId, midi);
    press(midi);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const held = pointers.current.get(e.pointerId);
    if (held === undefined) return;
    pointers.current.delete(e.pointerId);
    release(held);
  };

  const allMidis: number[] = [];
  for (let m = lowMidi; m <= highMidi; m++) allMidis.push(m);
  const whiteMidis = allMidis.filter(m => !isBlackKey(m));
  const whiteW = 100 / whiteMidis.length;
  const tones = new Set(chordTones ?? []);

  const keyProps = (midi: number) => ({
    "data-midi": midi,
    "data-down": down.has(midi),
    "data-playing": highlightedMidi === midi,
    "data-target": targetMidi === midi,
    "data-flash": visibleFlash?.midi === midi ? visibleFlash.kind : undefined,
    "aria-label": midiToNote(midi),
  });

  const octaveLabel = `C${Math.floor(anchorC / 12) - 1}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="panel-label hidden sm:block">
          Play with your mouse, touch, or the A–; row. Brass ticks mark the chord tones.
        </p>
        <p className="panel-label sm:hidden">Brass ticks mark the chord tones.</p>
        <div className="flex items-center gap-2" aria-label="Computer-keyboard octave">
          <button
            type="button"
            className="cap h-8 w-8"
            onClick={() => setOctaveShift(Math.max(0, shift - 1))}
            disabled={shift <= 0}
            aria-label="Keyboard octave down (Z)"
          >
            −
          </button>
          <span className="num panel-label w-16 text-center hidden sm:inline">Keys at {octaveLabel}</span>
          <button
            type="button"
            className="cap h-8 w-8"
            onClick={() => setOctaveShift(Math.min(maxShift, shift + 1))}
            disabled={shift >= maxShift}
            aria-label="Keyboard octave up (X)"
          >
            +
          </button>
        </div>
      </div>

      <div
        className="keybed"
        style={{ height: "clamp(150px, 24vw, 210px)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={e => e.preventDefault()}
        role="group"
        aria-label="Piano keyboard"
      >
        <div className="relative h-full">
          {whiteMidis.map((midi, i) => {
            const label = midiToKeyLabel(midi, anchorC);
            return (
              <div
                key={midi}
                className="key key-white"
                style={{ left: `calc(${i * whiteW}% + 1.5px)`, width: `calc(${whiteW}% - 3px)` }}
                {...keyProps(midi)}
              >
                {tones.has(midi % 12) && <span className="key-tone" aria-hidden="true" />}
                <span className="key-dot" aria-hidden="true" />
                {label && <span className="key-label hidden sm:block">{label}</span>}
                {midi % 12 === 0 && <span className="key-label num">C{Math.floor(midi / 12) - 1}</span>}
              </div>
            );
          })}
          {allMidis.filter(isBlackKey).map(midi => {
            const whiteIndex = whiteMidis.indexOf(midi - 1);
            if (whiteIndex === -1) return null;
            const label = midiToKeyLabel(midi, anchorC);
            return (
              <div
                key={midi}
                className="key key-black"
                style={{ left: `${(whiteIndex + 0.68) * whiteW}%`, width: `${0.64 * whiteW}%` }}
                {...keyProps(midi)}
              >
                {tones.has(midi % 12) && <span className="key-tone" aria-hidden="true" />}
                <span className="key-dot" aria-hidden="true" />
                {label && <span className="key-label hidden sm:block">{label}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
