import { useCallback, useEffect } from "react";
import { useLick } from "./hooks/useLick";
import { usePlayback } from "./hooks/usePlayback";
import { loadTone } from "./utils/tone-loader";
import { computePianoRange, parsePitch } from "./utils/music";
import { Header } from "./components/Header";
import { SheetMusic } from "./components/SheetMusic";
import { TransportControls } from "./components/TransportControls";
import { Piano } from "./components/Piano";

function App() {
  const { lick, loading, error, newLick, isDaily, notesPending } = useLick();

  // Warm the Tone.js chunk on the user's first interaction anywhere on the
  // page, so it's cached by the time they hit Play / a piano key. Kept out of
  // the initial bundle (dynamic import) but hidden behind the first gesture's
  // network idle rather than paid for on Play.
  useEffect(() => {
    const preload = () => { void loadTone(); };
    window.addEventListener("pointerdown", preload, { once: true });
    return () => window.removeEventListener("pointerdown", preload);
  }, []);

  const playback = usePlayback(lick.notes, lick.tempo, { swing: lick.swing, chords: lick.chords, timeSignature: lick.timeSignature, genre: lick.genre });
  const pianoRange = computePianoRange(lick.notes);

  // Destructure the stable (useCallback) fns so these wrappers keep a stable
  // identity across a playback sweep — otherwise depending on the whole
  // `playback` object (recreated each render) rebuilds them every note tick and
  // defeats the memo on Header/Piano.
  const { stop: stopPlayback, playNote } = playback;

  const handleNewLick = useCallback(() => {
    stopPlayback();
    newLick();
  }, [newLick, stopPlayback]);

  const handleNotePlay = useCallback(
    (pitch: string) => {
      playNote(pitch);
    },
    [playNote],
  );

  const highlightedMidi =
    playback.currentNoteIndex >= 0
      ? parsePitch(lick.notes[playback.currentNoteIndex].pitch).midi
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Header
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
          currentNoteIndex={playback.currentNoteIndex}
        />

        <TransportControls
          isPlaying={playback.isPlaying}
          onPlay={playback.play}
          onPause={playback.pause}
          onStop={playback.stop}
          tempo={playback.tempo}
          onTempoChange={playback.setTempo}
          chordsEnabled={playback.chordsEnabled}
          onChordsToggle={playback.setChordsEnabled}
          playDisabled={notesPending}
        />

        <Piano
          lowMidi={pianoRange.low}
          highMidi={pianoRange.high}
          onNotePlay={handleNotePlay}
          highlightedMidi={highlightedMidi}
        />
      </div>
    </div>
  );
}

export default App;
