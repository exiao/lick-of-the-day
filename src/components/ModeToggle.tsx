interface ModeToggleProps {
  mode: "listen" | "practice";
  onModeChange: (mode: "listen" | "practice") => void;
}

const MODES = [
  { value: "listen", label: "Listen" },
  { value: "practice", label: "Play it back" },
] as const;

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="well-sm inline-flex gap-1 p-1.5" role="radiogroup" aria-label="Mode">
      {MODES.map(m => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={mode === m.value}
          onClick={() => onModeChange(m.value)}
          className="cap h-9 px-4"
          style={mode === m.value ? { color: "var(--cobalt)" } : { boxShadow: "none", background: "transparent" }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
