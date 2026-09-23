import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLick } from "./hooks/useLick";
import { usePlayback } from "./hooks/usePlayback";
import { usePracticeMode } from "./hooks/usePracticeMode";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { loadTone } from "./utils/tone-loader";
import { preloadPianoSampler } from "./utils/piano-sampler";
import { computePianoRange, noteOnsets, pitchToMidiOrNull } from "./utils/music";
import { chordAtBeat, chordPitchClasses } from "./utils/chords";
import { CURATED_LICKS, type CuratedLick } from "./utils/curated-licks";
import { SOUL_LICKS } from "./utils/soul-licks";
import type { Lick, Note } from "./types/lick";
import {
  gridToNotes, spellingForKey, noteAtStep, notesToAbc, notesToGrid, setStepPitch, toggleStep, transposeStep,
  type Grid,
} from "./sequencer/grid";
import { suggestPitch } from "./sequencer/suggest";
import { Header } from "./components/Header";
import { Display } from "./components/Display";
import { SheetMusic } from "./components/SheetMusic";
import { TransportControls } from "./components/TransportControls";
import { ModeToggle } from "./components/ModeToggle";
import { Piano } from "./components/Piano";
import { Pathway, type StudioSet } from "./components/Pathway";
import { Sequencer } from "./components/Sequencer";
import { GrooveControls } from "./components/GrooveControls";

const STUDIO_SETS: StudioSet[] = [
  { id: "soul", title: "R&B / soul set", blurb: "Syncopated call-and-response phrases that leave room for the groove.", licks: SOUL_LICKS },
  { id: "jazz", title: "Jazz studio set", blurb: "Three original licks, then a short tune.", licks: CURATED_LICKS },
];
/** An ABC tie ("-" outside chord-symbol quotes and header lines). */
const hasTie = (abc: string) =>
  abc.split("\n").filter(l => !/^[A-Za-z]:/.test(l)).join(" ").replace(/"[^"]*"/g, "").includes("-");

const ALL_STUDIO = STUDIO_SETS.flatMap(set => set.licks.map(c => ({ set, c })));

type Mode = "listen" | "practice";

function App() {
  const { lick: sourceLick, loading, error, newLick, isDaily, notesPending, selectLick, showDaily } = useLick();
  const [mode, setMode] = useState<Mode>("listen");
  const [flash, setFlash] = useState<{ midi: number; kind: "hit" | "miss"; id: number } | null>(null);
  const flashId = useRef(0);

  // Warm the Tone.js chunk on the user's first interaction anywhere on the
  // page, so it's cached by the time they hit Play / a piano key. Kept out of
  // the initial bundle (dynamic import) but hidden behind the first gesture's
  // network idle rather than paid for on Play.
  useEffect(() => {
    const preload = () => {
      void loadTone().then(preloadPianoSampler);
    };
    window.addEventListener("pointerdown", preload, { once: true });
    window.addEventListener("keydown", preload, { once: true });
    return () => {
      window.removeEventListener("pointerdown", preload);
      window.removeEventListener("keydown", preload);
    };
  }, []);

  // --- Sequencer edits: one override per lick. The notation is regenerated from
  // the edited notes, so the staff, pads and playback all read the same notes. ---
  const [edit, setEdit] = useState<{ id: string; notes: Note[] } | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [armedFor, setArmedFor] = useState(sourceLick.id);
  if (armedFor !== sourceLick.id) {
    setArmedFor(sourceLick.id);
    setArmed(null);
    setEdit(null);
  }
  const edited = edit !== null && edit.id === sourceLick.id;
  // Once the notes are complete, the staff is always drawn from them (not from
  // the lick's own ABC, which a generated lick can get wrong), so what you read,
  // what the pads show and what you hear are one list of notes.
  const lick: Lick = useMemo(() => {
    const notes = edit && edit.id === sourceLick.id ? edit.notes : sourceLick.notes;
    if (notesPending || notes.length === 0) return sourceLick;
    try {
      const abc = notesToAbc(notes, {
        key: sourceLick.key, timeSignature: sourceLick.timeSignature, bars: sourceLick.bars, chords: sourceLick.chords,
      });
      // A tie (a generated note crossing a bar line) adds a staff element and
      // would shift the note highlight; keep the lick's own ABC for those.
      if (hasTie(abc)) return { ...sourceLick, notes };
      return { ...sourceLick, notes, abc };
    } catch (err) {
      console.warn("[sequencer] could not write notation from notes:", err);
      return { ...sourceLick, notes };
    }
  }, [sourceLick, edit, notesPending]);
  const grid = useMemo(
    () => (notesPending ? null : notesToGrid(lick.notes, lick.bars, lick.timeSignature)),
    [lick.notes, lick.bars, lick.timeSignature, notesPending],
  );

  const playback = usePlayback(lick.notes, lick.tempo, { id: lick.id, swing: lick.swing, chords: lick.chords, timeSignature: lick.timeSignature, genre: lick.genre });
  const practice = usePracticeMode(lick.notes);
  const narrow = useMediaQuery("(max-width: 640px)");
  const pianoRange = computePianoRange(lick.notes, { compact: narrow });
  const studio = ALL_STUDIO.find(({ c }) => c.lick.id === lick.id);
  const studioEyebrow = studio
    ? `${studio.set.title} · Level ${studio.c.level} ${studio.c.kind} · ${lick.bars} bars${edited ? " · edited" : ""}`
    : edited ? `Edited · ${lick.bars} bars` : undefined;

  // Destructure the stable (useCallback) fns so these wrappers keep a stable
  // identity across a playback sweep — otherwise depending on the whole
  // `playback` object (recreated each render) rebuilds them every note tick and
  // defeats the memo on Header/Piano.
  const { stop: stopPlayback, noteOn, noteOff, setTempo, play, pause, isPlaying } = playback;
  const { checkNote } = practice;

  const handleNewLick = useCallback(() => {
    stopPlayback();
    newLick();
  }, [newLick, stopPlayback]);

  // Studio licks start at their practice tempo; the knob's brass tick keeps the goal tempo.
  const pendingTempo = useRef<number | null>(null);
  const handleSelectStudio = useCallback((c: CuratedLick) => {
    stopPlayback();
    if (c.lick.id === lick.id) {
      setTempo(c.practiceTempo);
      return;
    }
    pendingTempo.current = c.practiceTempo;
    selectLick(c.lick);
  }, [lick.id, selectLick, setTempo, stopPlayback]);
  useEffect(() => {
    if (pendingTempo.current !== null) {
      setTempo(pendingTempo.current);
      pendingTempo.current = null;
    }
  }, [lick.id, setTempo]);

  const handleToday = useCallback(() => {
    stopPlayback();
    showDaily();
  }, [showDaily, stopPlayback]);

  const handleModeChange = useCallback((next: Mode) => {
    stopPlayback();
    setMode(next);
  }, [stopPlayback]);

  // --- Sequencer editing ---
  const beatsPerBar = parseInt(lick.timeSignature.split("/")[0]) || 4;
  const canEdit = mode === "listen" && grid !== null;
  // No chord-change splits here: they would re-cut notes the user never touched
  // (a note held across a change). Only bar lines and unwritable lengths split.
  const commitGrid = useCallback((g: Grid) => {
    setEdit({ id: sourceLick.id, notes: gridToNotes(g) });
  }, [sourceLick.id]);

  // A short audition of an edited step, unless the transport is already playing it.
  const audition = useCallback((pitch: string) => {
    if (isPlaying) return;
    noteOn(pitch);
    window.setTimeout(() => noteOff(pitch), 220);
  }, [isPlaying, noteOn, noteOff]);

  const handlePad = useCallback((step: number) => {
    if (!grid || !canEdit) return;
    const hit = noteAtStep(grid, step);
    if (hit?.isOnset && armed !== step) {
      setArmed(step);
      audition(hit.note.pitch);
      return;
    }
    const prev = [...grid.notes].reverse().find(n => n.step < step);
    const res = toggleStep(grid, step, suggestPitch(sourceLick.chords, beatsPerBar, step, prev ? pitchToMidiOrNull(prev.pitch) : null));
    commitGrid(res.grid);
    setArmed(res.armed);
    const added = res.armed !== null ? noteAtStep(res.grid, res.armed) : null;
    if (added) audition(added.note.pitch);
  }, [grid, canEdit, armed, audition, sourceLick.chords, beatsPerBar, commitGrid]);

  const handleNudge = useCallback((step: number, semitones: number) => {
    if (!grid || !canEdit) return;
    const next = transposeStep(grid, step, semitones, undefined, spellingForKey(sourceLick.key));
    commitGrid(next);
    setArmed(step);
    const moved = noteAtStep(next, step);
    if (moved) audition(moved.note.pitch);
  }, [grid, canEdit, commitGrid, audition, sourceLick.key]);

  const handleClear = useCallback((step: number) => {
    if (!grid || !canEdit) return;
    const hit = noteAtStep(grid, step);
    if (!hit?.isOnset) return;
    commitGrid(toggleStep(grid, step, hit.note.pitch).grid);
    setArmed(null);
  }, [grid, canEdit, commitGrid]);

  const handleRevert = useCallback(() => {
    setEdit(null);
    setArmed(null);
  }, []);

  const handleNoteOn = useCallback(
    (pitch: string, midi: number) => {
      noteOn(pitch);
      if (mode === "practice") {
        const result = checkNote(pitch);
        setFlash({ midi, kind: result === "correct" ? "hit" : "miss", id: ++flashId.current });
      } else if (grid && armed !== null && noteAtStep(grid, armed)?.isOnset) {
        // Listen mode with a selected pad: the key you play becomes its pitch.
        commitGrid(setStepPitch(grid, armed, pitch));
      }
    },
    [noteOn, mode, checkNote, grid, armed, commitGrid],
  );
  const handleNoteOff = useCallback((pitch: string) => noteOff(pitch), [noteOff]);

  // Space toggles the transport (unless a control has focus and wants it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.target instanceof HTMLElement && e.target !== document.body) return;
      e.preventDefault();
      if (notesPending && !isPlaying) return;
      if (isPlaying) pause();
      else play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlaying, pause, play, notesPending]);

  // --- What the display and keybed describe right now ---
  const onsets = useMemo(() => noteOnsets(lick.notes), [lick.notes]);
  const sortedChords = useMemo(
    () => [...lick.chords].sort((a, b) => a.bar - b.bar || a.beat - b.beat),
    [lick.chords],
  );

  const focusIndex = mode === "practice" ? practice.currentNoteIndex : playback.currentNoteIndex;
  const focusPitch = focusIndex >= 0 ? lick.notes[focusIndex]?.pitch : undefined;
  const focusMidi = focusPitch ? pitchToMidiOrNull(focusPitch) : null;
  const focusBeat =
    mode === "listen" && playback.currentBeat >= 0 && focusIndex < 0
      ? playback.currentBeat
      : focusIndex >= 0 ? onsets[focusIndex] ?? 0 : 0;
  const active = chordAtBeat(sortedChords, focusBeat, beatsPerBar);
  const activeChordIndex = active?.index ?? 0;
  const chordTones = useMemo(
    () => (sortedChords[activeChordIndex] ? chordPitchClasses(sortedChords[activeChordIndex].chord) : []),
    [sortedChords, activeChordIndex],
  );

  const highlightedMidi = mode === "listen" ? focusMidi : null;
  const targetMidi = mode === "practice" && practice.showHint ? focusMidi : null;
  const displayBeat = mode === "listen" && playback.currentBeat >= 0 ? playback.currentBeat : focusBeat;

  return (
    <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-9 space-y-8">
      <div className="chassis p-4 sm:p-7 space-y-5">
        <Header
          onNewLick={handleNewLick}
          loading={loading}
          lickTitle={lick.title}
          lickKey={lick.key}
          lickGenre={lick.genre}
          eyebrow={studioEyebrow}
          isDaily={isDaily}
          tempo={lick.tempo}
        />

        {error && (
          <p role="alert" className="well-sm px-4 py-2.5 text-sm" style={{ color: "var(--miss)" }}>
            {error}
          </p>
        )}

        <Display
          chords={sortedChords}
          bars={lick.bars}
          beatsPerBar={beatsPerBar}
          beat={displayBeat}
          pulsing={mode === "listen" && playback.isPlaying}
          activeChordIndex={activeChordIndex}
          note={focusPitch && focusMidi !== null ? { name: focusPitch, midi: focusMidi } : null}
          mode={mode}
          practice={{
            step: practice.currentIndex,
            total: practice.total,
            misses: practice.misses,
            complete: practice.isComplete,
            result: practice.lastResult,
          }}
        />

        <SheetMusic
          abc={lick.abc}
          narrow={narrow}
          currentNoteIndex={focusIndex}
          completedNotes={mode === "practice" ? (practice.isComplete ? lick.notes.length : practice.currentNoteIndex) : undefined}
        />

        <Sequencer
          grid={grid}
          chords={sortedChords}
          beatsPerBar={beatsPerBar}
          armed={canEdit ? armed : null}
          editable={canEdit}
          edited={edited}
          target={mode === "practice" && practice.showHint && focusIndex >= 0 ? Math.round((onsets[focusIndex] ?? 0) * 4) : null}
          steps={playback.steps}
          onPad={handlePad}
          onNudge={handleNudge}
          onClear={handleClear}
          onRevert={handleRevert}
        />

        <TransportControls
          isPlaying={playback.isPlaying}
          onPlay={playback.play}
          onPause={playback.pause}
          onStop={playback.stop}
          tempo={playback.tempo}
          originalTempo={lick.tempo}
          onTempoChange={playback.setTempo}
          swing={playback.swing}
          originalSwing={lick.swing ?? 0}
          onSwingChange={playback.setSwing}
          chordsEnabled={playback.chordsEnabled}
          onChordsToggle={playback.setChordsEnabled}
          loopEnabled={playback.loopEnabled}
          onLoopToggle={playback.setLoopEnabled}
          clickEnabled={playback.clickEnabled}
          onClickToggle={playback.setClickEnabled}
          playDisabled={notesPending}
        />

        <GrooveControls
          style={playback.grooveStyle}
          onStyleChange={playback.setGrooveStyle}
          drumsEnabled={playback.drumsEnabled}
          onDrumsToggle={playback.setDrumsEnabled}
          bassEnabled={playback.bassEnabled}
          onBassToggle={playback.setBassEnabled}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <ModeToggle mode={mode} onModeChange={handleModeChange} />
          {mode === "practice" ? (
            <div className="flex items-center gap-2.5">
              <button type="button" className="cap h-9 px-3.5" aria-pressed={practice.showHint} onClick={practice.toggleHint}>
                <span className="led" aria-hidden="true" /> Show next key
              </button>
              <button type="button" className="cap h-9 px-3.5" onClick={practice.restart}>
                Restart
              </button>
            </div>
          ) : (
            <p className="panel-label">Listen first, then switch modes and play it back note by note.</p>
          )}
        </div>

        <Piano
          lowMidi={pianoRange.low}
          highMidi={pianoRange.high}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          highlightedMidi={highlightedMidi}
          chordTones={chordTones}
          targetMidi={targetMidi}
          flash={flash}
        />
      </div>

      <Pathway
        sets={STUDIO_SETS}
        activeId={lick.id}
        isDaily={isDaily}
        disabled={loading}
        onSelect={handleSelectStudio}
        onToday={handleToday}
      />
    </main>
  );
}

export default App;
