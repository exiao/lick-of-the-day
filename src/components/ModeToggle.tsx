interface ModeToggleProps {
  mode: "listen" | "practice";
  onModeChange: (mode: "listen" | "practice") => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex justify-center gap-1 bg-gray-100 rounded-lg p-1 w-fit mx-auto">
      <button
        onClick={() => onModeChange("listen")}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === "listen"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Listen
      </button>
      <button
        onClick={() => onModeChange("practice")}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === "practice"
            ? "bg-white text-green-600 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Practice
      </button>
    </div>
  );
}
