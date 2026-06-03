import { useState, useCallback, useEffect, useRef } from "react";
import type { Lick, Genre } from "../types/lick";
import { FALLBACK_LICK } from "../utils/mock-lick";
import { streamLick } from "../utils/stream-lick";
import type { PartialLick } from "../utils/partial-json";

const ALL_GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];
const DEFAULT_BARS = 4;

function randomGenre(): Genre {
  return ALL_GENRES[Math.floor(Math.random() * ALL_GENRES.length)];
}

// Streaming generation phases for the cold path.
//   idle        nothing in flight
//   waiting     request sent, nothing renderable yet
//   sheet       abc has arrived: sheet music can paint, notes still streaming
//   notes       notes complete: playback can start
export type GenPhase = "idle" | "waiting" | "sheet" | "notes";

// Full background fetch (no progressive UI) — used to warm the prefetch cache so
// "New Lick" is instant when the user is ahead of generation.
async function fetchLickFull(genre: Genre, bars: number): Promise<Lick> {
  return streamLick(genre, bars);
}

interface UseLickReturn {
  lick: Lick;
  loading: boolean;
  error: string | null;
  fetchDaily: () => Promise<void>;
  newLick: () => Promise<void>;
  isDaily: boolean;
  /** Cold-path streaming phase; "notes" or "idle" once a lick is fully ready. */
  phase: GenPhase;
  /** True while notes are still streaming in (gate playback on this). */
  notesPending: boolean;
}

// Overlay whatever partial fields have arrived onto a base lick so the rendered
// object is always complete (no undefined access), while progressively
// revealing the streamed title/key/abc/notes.
function overlay(base: Lick, p: PartialLick): Lick {
  return {
    ...base,
    ...(p.genre !== undefined ? { genre: p.genre as Genre } : {}),
    ...(p.title !== undefined ? { title: p.title } : {}),
    ...(p.key !== undefined ? { key: p.key } : {}),
    ...(p.timeSignature !== undefined ? { timeSignature: p.timeSignature } : {}),
    ...(p.feel !== undefined ? { feel: p.feel } : {}),
    ...(p.bars != null ? { bars: p.bars } : {}),
    ...(p.tempo != null ? { tempo: p.tempo } : {}),
    ...(p.swing != null ? { swing: p.swing } : {}),
    ...(Array.isArray(p.chords) ? { chords: p.chords as Lick["chords"] } : {}),
    ...(p.abc !== undefined ? { abc: p.abc } : {}),
    ...(Array.isArray(p.notes) ? { notes: p.notes as Lick["notes"] } : {}),
  };
}

export function useLick(): UseLickReturn {
  const [lick, setLick] = useState<Lick>(FALLBACK_LICK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDaily, setIsDaily] = useState(true);
  const [phase, setPhase] = useState<GenPhase>("idle");
  const [notesPending, setNotesPending] = useState(false);

  // Background-prefetched next lick (random genre), so "New Lick" is instant.
  const prefetchRef = useRef<Promise<Lick> | null>(null);
  // Guard the mount fetch against React Strict Mode's double-invoke in dev.
  const initialFetchRef = useRef(false);

  const startPrefetch = useCallback(() => {
    const p = fetchLickFull(randomGenre(), DEFAULT_BARS);
    p.catch(() => {
      if (prefetchRef.current === p) prefetchRef.current = null;
    });
    prefetchRef.current = p;
  }, []);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Daily is a KV cache hit (cron pre-generates it), so a plain fetch is
      // already instant — no need to stream here.
      const res = await fetch("/api/daily");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Lick = await res.json();
      setLick(data);
      setIsDaily(true);
      setPhase("idle");
      setNotesPending(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch daily lick");
      setLick(FALLBACK_LICK);
      setIsDaily(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cold-path streaming generation with progressive render.
  const streamFresh = useCallback(async () => {
    setLoading(true);
    setPhase("waiting");
    setNotesPending(true);
    const genre = randomGenre();
    // Snapshot the currently-displayed lick so a mid-stream failure can roll
    // back instead of leaving sheet music paired with stale/partial notes.
    let prevLick = FALLBACK_LICK;
    setLick((cur) => { prevLick = cur; return cur; });
    try {
      const full = await streamLick(genre, DEFAULT_BARS, (partial) => {
        setLick((prev) => overlay(prev, partial));
        if (partial.abc !== undefined) setPhase((ph) => (ph === "waiting" ? "sheet" : ph));
      });
      setLick(full);
      setIsDaily(false);
      setPhase("notes");
      setNotesPending(false);
    } catch (err) {
      // Roll back to the last complete lick so we never show a half-streamed
      // sheet with mismatched notes or an enabled Play button.
      setLick(prevLick);
      setError(err instanceof Error ? err.message : "Failed to generate lick");
      setPhase("idle");
      setNotesPending(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Swap in the prefetched lick instantly; if none is ready, stream a fresh one
  // with progressive render so the cold path still feels fast.
  const newLick = useCallback(async () => {
    setError(null);
    const pending = prefetchRef.current;
    prefetchRef.current = null;

    if (pending) {
      setLoading(true);
      setPhase("waiting");
      try {
        const data = await pending;
        setLick(data);
        setIsDaily(false);
        setPhase("idle");
        setNotesPending(false);
      } catch {
        // Prefetch failed — fall back to a fresh streaming generation.
        await streamFresh();
      } finally {
        setLoading(false);
      }
    } else {
      // No prefetch ready (cold path): stream with progressive render.
      await streamFresh();
    }

    // Queue up the next one in the background.
    startPrefetch();
  }, [startPrefetch, streamFresh]);

  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    fetchDaily().then(() => startPrefetch());
  }, [fetchDaily, startPrefetch]);

  return { lick, loading, error, fetchDaily, newLick, isDaily, phase, notesPending };
}
