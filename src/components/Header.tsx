interface HeaderProps {
  onNewLick: () => void;
  loading: boolean;
  lickTitle: string;
  lickKey: string;
  lickGenre: string;
  isDaily: boolean;
}

export function Header({
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
            {today} · {lickGenre} · Key of {lickKey}
            {isDaily && " · Daily"}
          </p>
        </div>

        <button
          onClick={onNewLick}
          disabled={loading}
          className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating..." : "New Lick"}
        </button>
      </div>

      <p className="text-lg font-medium text-gray-800">{lickTitle}</p>
    </div>
  );
}
