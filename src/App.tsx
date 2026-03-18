import { useState, useCallback } from "react";
import type { Genre } from "./types/lick";
import { useLick } from "./hooks/useLick";
import { usePlayback } from "./hooks/usePlayback";
import { computePianoRange, parsePitch } from "./utils/music";
import { Header } from "./components/Header";
import { SheetMusic } from "./components/SheetMusic";
import { TransportControls } from "./components/TransportControls";
import { Piano } from "./components/Piano";

function App() {
  const { lick, loading, error, fetchRandom, isDaily } = useLick();
  const [genre, setGenre] = useState<Genre>("jazz");
  const [bars, setBars] = useState(4);

  const playback = usePlayback(lick.notes, lick.tempo, { swing: lick.swing, chords: lick.chords, timeSignature: lick.timeSignature, genre: lick.genre });
  const pianoRange = computePianoRange(lick.notes);

  const handleNewLick = useCallback(() => {
    playback.stop();
    fetchRandom(genre, bars);
  }, [genre, bars, fetchRandom, playback]);

  const handleNotePlay = useCallback(
    (pitch: string) => {
      playback.playNote(pitch);
    },
    [playback],
  );

  const highlightedMidi =
    playback.currentNoteIndex >= 0
      ? parsePitch(lick.notes[playback.currentNoteIndex].pitch).midi
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
