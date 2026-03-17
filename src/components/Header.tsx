import type { Genre } from "../types/lick";
import { GENRES, BAR_OPTIONS } from "../types/lick";

interface HeaderProps {
  genre: Genre;
  onGenreChange: (genre: Genre) => void;
  bars: number;
  onBarsChange: (bars: number) => void;
  onNewLick: () => void;
  loading: boolean;
  lickTitle: string;
  lickKey: string;
  lickGenre: string;
  isDaily: boolean;
}

export function Header({
  genre,
  onGenreChange,
  bars,
  onBarsChange,
  onNewLick,
  loading,
  lickTitle,
  lickKey,
  lickGenre,
  isDaily,
}: HeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-3 pb-4 border-b border-gray-200">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Lick of the Day
          </h1>
          <p className="text-sm text-gray-500">
            {today} &middot; {lickGenre} &middot; Key of {lickKey}
            {isDaily && " &middot; Daily"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={genre}
            onChange={(e) => onGenreChange(e.target.value as Genre)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {GENRES.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>

          <div className="flex gap-1">
            {BAR_OPTIONS.map(b => (
              <button
                key={b}
                onClick={() => onBarsChange(b)}
                className={`px-2 py-1 text-xs rounded ${
                  bars === b
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {b} bars
              </button>
            ))}
          </div>

          <button
            onClick={onNewLick}
            disabled={loading}
            className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Generating..." : "New Lick"}
          </button>
        </div>
      </div>

      <p className="text-lg font-medium text-gray-800">{lickTitle}</p>
    </div>
  );
}
