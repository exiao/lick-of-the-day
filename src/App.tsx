import { useState, useCallback } from "react";
import type { Genre } from "./types/lick";
import { useLick } from "./hooks/useLick";
import { usePlayback } from "./hooks/usePlayback";
import { usePracticeMode } from "./hooks/usePracticeMode";
import { computePianoRange, parsePitch } from "./utils/music";
import { Header } from "./components/Header";
import { SheetMusic } from "./components/SheetMusic";
import { TransportControls } from "./components/TransportControls";
import { ModeToggle } from "./components/ModeToggle";
import { Piano } from "./components/Piano";
import { PracticeControls } from "./components/PracticeControls";

function App() {
  const { lick, loading, error, fetchRandom, isDaily } = useLick();
  const [genre, setGenre] = useState<Genre>("jazz");
  const [bars, setBars] = useState(4);
  const [mode, setMode] = useState<"listen" | "practice">("listen");

  const playback = usePlayback(lick.notes, lick.tempo);
  const practice = usePracticeMode(lick.notes);

  const pianoRange = computePianoRange(lick.notes);

  const handleNewLick = useCallback(() => {
    playback.stop();
    practice.restart();
    fetchRandom(genre, bars);
  }, [genre, bars, fetchRandom, playback, practice]);

  const handleModeChange = useCallback(
    (newMode: "listen" | "practice") => {
      if (newMode === "practice") {
        playback.stop();
        practice.restart();
      }
      setMode(newMode);
    },
    [playback, practice],
  );

  const handleNotePlay = useCallback(
    (pitch: string, _midi: number) => {
      playback.playNote(pitch);
      if (mode === "practice") {
        practice.checkNote(pitch);
      }
    },
    [mode, playback, practice],
  );

  // Get highlighted MIDI for listen mode
  const highlightedMidi =
    mode === "listen" && playback.currentNoteIndex >= 0
      ? parsePitch(lick.notes[playback.currentNoteIndex].pitch).midi
      : null;

  // Get expected MIDI for practice mode
  const expectedMidi =
    mode === "practice" && practice.expectedPitch
      ? parsePitch(practice.expectedPitch).midi
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Header
          genre={genre}
          onGenreChange={setGenre}
          bars={bars}
          onBarsChange={setBars}
          onNewLick={handleNewLick}
          loading={loading}
          lickTitle={lick.title}
          lickKey={lick.key}
          lickGenre={lick.genre}
          isDaily={isDaily}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <SheetMusic
          abc={lick.abc}
          currentNoteIndex={mode === "listen" ? playback.currentNoteIndex : practice.currentIndex}
          completedNotes={mode === "practice" ? practice.currentIndex : undefined}
        />

        <ModeToggle mode={mode} onModeChange={handleModeChange} />

        {mode === "listen" && (
          <TransportControls
            isPlaying={playback.isPlaying}
            onPlay={playback.play}
            onPause={playback.pause}
            onStop={playback.stop}
            tempo={playback.tempo}
            onTempoChange={playback.setTempo}
          />
        )}

        {mode === "practice" && (
          <PracticeControls
            score={practice.score}
            total={practice.total}
            currentIndex={practice.currentIndex}
            isComplete={practice.isComplete}
            showHint={practice.showHint}
            onToggleHint={practice.toggleHint}
            onRestart={practice.restart}
            onNextLick={handleNewLick}
            expectedPitch={practice.expectedPitch}
            lastResult={practice.lastResult}
          />
        )}

        <Piano
          lowMidi={pianoRange.low}
          highMidi={pianoRange.high}
          onNotePlay={handleNotePlay}
          highlightedMidi={highlightedMidi}
          expectedMidi={expectedMidi}
          showHint={practice.showHint}
          lastResult={practice.lastResult}
        />
      </div>
    </div>
  );
}

export default App;
