import { useEffect, useRef, useState } from "react";

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Double-click / Home resets here; also drawn as a brass tick on the arc. */
  defaultValue: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  size?: number;
}

// 270° sweep, -135° (min) to +135° (max). The arc path is a circle with
// pathLength=100, rotated so dash offset 0 sits at the min position.
const SWEEP = 270;

export function Knob({ label, value, min, max, step = 1, defaultValue, onChange, format, size = 76 }: KnobProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const range = max - min;
  const norm = (v: number) => (v - min) / range;
  const clamp = (v: number) => {
    const snapped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
  };

  // Keep the latest onChange/value for the non-React wheel listener.
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });

  // Wheel needs a non-passive listener so the page doesn't scroll while turning.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? step : step * 2);
      const next = Math.min(max, Math.max(min, latest.current.value + delta));
      latest.current.onChange(Number(next.toFixed(4)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [min, max, step]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, v: value };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // ~180px of travel covers the full range; Shift for fine control.
    const pxForRange = e.shiftKey ? 720 : 180;
    const next = clamp(drag.current.v + ((drag.current.y - e.clientY) / pxForRange) * range);
    if (next !== value) onChange(next);
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const big = step * 10;
    const map: Record<string, number> = {
      ArrowUp: value + step, ArrowRight: value + step,
      ArrowDown: value - step, ArrowLeft: value - step,
      PageUp: value + big, PageDown: value - big,
      Home: defaultValue, End: max,
    };
    if (e.key in map) {
      e.preventDefault();
      onChange(clamp(map[e.key]));
    }
  };

  const n = norm(value);
  const home = norm(defaultValue);
  const homeAngle = ((-135 + SWEEP * home) * Math.PI) / 180;
  const valueText = format(value);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={ref}
        className="knob"
        style={{ "--knob-size": `${size}px`, "--rot": `${-135 + SWEEP * n}deg` } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        data-dragging={dragging}
        title={`${label}: drag, scroll or use arrow keys. Double-click to reset.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => onChange(defaultValue)}
        onKeyDown={onKeyDown}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--plate-lo)" strokeOpacity=".55" strokeWidth="3.5"
            pathLength={100} strokeDasharray="75 100" strokeLinecap="round" transform="rotate(135 50 50)" />
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--cobalt)" strokeWidth="3.5"
            pathLength={100} strokeDasharray={`${Math.max(0.01, 75 * n)} 100`} strokeLinecap="round"
            transform="rotate(135 50 50)" />
          <line
            x1={50 + 40 * Math.sin(homeAngle)} y1={50 - 40 * Math.cos(homeAngle)}
            x2={50 + 52 * Math.sin(homeAngle)} y2={50 - 52 * Math.cos(homeAngle)}
            stroke="var(--brass)" strokeWidth="3" strokeLinecap="round"
          />
        </svg>
        <div className="knob-cap" />
      </div>
      <div className="text-center leading-tight">
        <div className="num text-sm font-semibold">{valueText}</div>
        <div className="panel-label">{label}</div>
      </div>
    </div>
  );
}
