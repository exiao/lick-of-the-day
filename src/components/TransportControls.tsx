interface TransportControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  tempo: number;
  onTempoChange: (bpm: number) => void;
}

export function TransportControls({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  tempo,
  onTempoChange,
}: TransportControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-3">
      {!isPlaying ? (
        <button
          onClick={onPlay}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span className="text-lg">&#9654;</span> Play
        </button>
      ) : (
        <button
          onClick={onPause}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
        >
          <span className="text-lg">&#9646;&#9646;</span> Pause
        </button>
      )}

      <button
        onClick={onStop}
        className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
      >
        <span className="text-lg">&#9632;</span> Stop
      </button>

      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm text-gray-500">BPM</span>
        <input
          type="range"
          min={40}
          max={240}
          value={tempo}
          onChange={(e) => onTempoChange(parseInt(e.target.value))}
          className="w-24 sm:w-32"
        />
        <span className="text-sm font-mono w-8 text-right">{tempo}</span>
      </div>
    </div>
  );
}
