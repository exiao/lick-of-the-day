import { useState, useCallback, useEffect, useRef } from "react";
import type { Lick, Genre } from "../types/lick";
import { FALLBACK_LICK } from "../utils/mock-lick";
import { extractClosedFields } from "../utils/partial-json";

const ALL_GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];
const DEFAULT_BARS = 4;

function randomGenre(): Genre {
  return ALL_GENRES[Math.floor(Math.random() * ALL_GENRES.length)];
}

/** How far a streamed lick has progressed. Drives progressive UI reveal. */
export type LickPhase =
  | "idle"
  | "loading" // request sent, nothing parseable yet
  | "sheet-ready" // abc has arrived; sheet music can render
  | "notes-ready" // notes complete; playback enabled
  | "done"; // fully parsed and validated

/**
 * Merge streamed partial fields onto a base lick so the UI always has a
 * complete, render-safe object. Notes default to empty until they stream in.
 */
function overlay(base: Lick, partial: ReturnType<typeof extractClosedFields>): Lick {
  return {
    ...base,
    ...(partial.genre ? { genre: partial.genre as Genre } : {}),
    ...(partial.title ? { title: partial.title } : {}),
    ...(partial.bars ? { bars: partial.bars } : {}),
    ...(partial.tempo ? { tempo: partial.tempo } : {}),
    ...(partial.timeSignature ? { timeSignature: partial.timeSignature } : {}),
    ...(partial.key ? { key: partial.key } : {}),
    ...(partial.swing !== undefined ? { swing: partial.swing } : {}),
    ...(partial.feel ? { feel: partial.feel } : {}),
    ...(partial.chords ? { chords: partial.chords as Lick["chords"] } : {}),
    ...(partial.abc ? { abc: partial.abc } : {}),
    ...(partial.notes ? { notes: partial.notes as Lick["notes"] } : {}),
  };
}

/**
 * Read a streaming text response chunk by chunk, surfacing fields as they close
 * via `onPartial`, and return the assembled raw text for a final authoritative
 * parse. Parsing is throttled to structural boundaries to avoid O(n^2) churn.
 */
async function readLickStream(
  res: Response,
  onPartial: (p: ReturnType<typeof extractClosedFields>) => void,
): Promise<string> {
  if (!res.body) {
    // No streaming support (shouldn't happen on CF). Fall back to whole-body.
    const text = await res.text();
    onPartial(extractClosedFields(text));
    return text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let sinceParse = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buf += chunk;
    sinceParse += chunk.length;
    // Parse on a closing boundary or every ~48 chars, whichever comes first.
    const hasBoundary = /[}\]"]/.test(chunk);
    if (hasBoundary || sinceParse >= 48) {
      sinceParse = 0;
      onPartial(extractClosedFields(buf));
    }
  }
  onPartial(extractClosedFields(buf));
  return buf;
}

interface UseLickReturn {
  lick: Lick;
  loading: boolean;
  phase: LickPhase;
  /** True until the notes array has fully streamed in (playback should wait). */
  notesPending: boolean;
  error: string | null;
  fetchDaily: () => Promise<void>;
  newLick: () => Promise<void>;
  isDaily: boolean;
}

export function useLick(): UseLickReturn {
  const [lick, setLick] = useState<Lick>(FALLBACK_LICK);
  const [phase, setPhase] = useState<LickPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDaily, setIsDaily] = useState(true);

  const initialFetchRef = useRef(false);

  // Stream a lick from `url`, progressively updating state. `assignId` builds
  // the final id from the validated payload.
  const streamInto = useCallback(
    async (
      url: string,
      init: RequestInit | undefined,
      assignId: () => string,
      markDaily: boolean,
    ) => {
      setError(null);
      setPhase("loading");
      // Reset to a clean base so a stale lick's notes don't linger on screen.
      setLick({ ...FALLBACK_LICK, notes: [], title: "", chords: [] });
      setIsDaily(markDaily);

      let sawSheet = false;
      try {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const full = await readLickStream(res, (partial) => {
          setLick((prev) => overlay(prev, partial));
          if (!sawSheet && typeof partial.abc === "string") {
            sawSheet = true;
            setPhase("sheet-ready");
          }
          if (partial.notesComplete) {
            setPhase("notes-ready");
          }
        });

        // Final authoritative parse — the source of truth for playback.
        const parsed = JSON.parse(full);
        setLick({ id: assignId(), ...parsed });
        setPhase("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lick");
        // Only fall back to the canned lick if we never got a renderable sheet.
        if (!sawSheet) {
          setLick(FALLBACK_LICK);
          setPhase("done");
        }
      }
    },
    [],
  );

  const fetchDaily = useCallback(async () => {
    await streamInto("/api/daily", undefined, () => new Date().toISOString().split("T")[0], true);
  }, [streamInto]);

  const newLick = useCallback(async () => {
    const genre = randomGenre();
    await streamInto(
      "/api/random",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, bars: DEFAULT_BARS }),
      },
      () => `${new Date().toISOString().split("T")[0]}-${Date.now()}`,
      false,
    );
  }, [streamInto]);

  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    fetchDaily();
  }, [fetchDaily]);

  const loading = phase === "loading";
  const notesPending = phase !== "notes-ready" && phase !== "done";

  return { lick, loading, phase, notesPending, error, fetchDaily, newLick, isDaily };
}
