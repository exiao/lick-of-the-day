interface PracticeControlsProps {
  score: number;
  total: number;
  currentIndex: number;
  isComplete: boolean;
  showHint: boolean;
  onToggleHint: () => void;
  onRestart: () => void;
  onNextLick: () => void;
  expectedPitch: string | null;
  lastResult: "correct" | "incorrect" | null;
}

export function PracticeControls({
  score,
  total,
  currentIndex,
  isComplete,
  showHint,
  onToggleHint,
  onRestart,
  onNextLick,
  expectedPitch,
  lastResult,
}: PracticeControlsProps) {
  if (isComplete) {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-2xl font-bold text-green-600">
          Complete! {score}/{total} correct
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={onRestart}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Restart
          </button>
          <button
            onClick={onNextLick}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Next Lick
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 flex-wrap gap-2">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600">
          Note {currentIndex + 1} of {total}
        </span>
        <span className="text-sm text-gray-500">
          Score: {score}/{total}
        </span>
        {lastResult && (
          <span
            className={`text-sm font-medium ${
              lastResult === "correct" ? "text-green-600" : "text-red-500"
            }`}
          >
            {lastResult === "correct" ? "Correct!" : "Try again"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {expectedPitch && showHint && (
          <span className="text-sm text-yellow-600 font-mono">
            Hint: {expectedPitch}
          </span>
        )}
        <button
          onClick={onToggleHint}
          className={`px-3 py-1 text-sm rounded-lg ${
            showHint
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {showHint ? "Hide Hint" : "Show Hint"}
        </button>
        <button
          onClick={onRestart}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
        >
          Restart
        </button>
      </div>
    </div>
  );
}
