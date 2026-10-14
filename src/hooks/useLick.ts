import { useState, useCallback, useEffect, useRef } from "react";
import type { Lick, Genre } from "../types/lick";
import { SOUL_LICKS } from "../utils/soul-licks";
import { streamLick } from "../utils/stream-lick";
import { parseLick } from "../utils/lick-validation";
import { readJsonResponse, reportLickError } from "../utils/lick-errors";

const ALL_GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];
const DEFAULT_BARS = 4;
const FALLBACK_LICK = SOUL_LICKS[0].lick;

function randomGenre(): Genre {
  return ALL_GENRES[Math.floor(Math.random() * ALL_GENRES.length)];
}

interface UseLickReturn {
  lick: Lick;
  loading: boolean;
  error: string | null;
  newLick: () => Promise<void>;
  isDaily: boolean;
  /** True while notes are still streaming in (gate playback on this). */
  notesPending: boolean;
  /** Show a specific, already-complete lick (e.g. a curated studio lick). */
  selectLick: (lick: Lick) => void;
  /** Go back to today's shared lick. */
  showDaily: () => void;
}

export function useLick(): UseLickReturn {
  const [lick, setLick] = useState<Lick>(FALLBACK_LICK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDaily, setIsDaily] = useState(false);
  const [notesPending, setNotesPending] = useState(false);

  // Background-prefetched next lick (random genre), so "New Lick" is instant.
  const prefetchRef = useRef<Promise<Lick> | null>(null);
  // Guard the mount fetch against React Strict Mode's double-invoke in dev.
  const initialFetchRef = useRef(false);
  // The last daily lick we received, so "Today" can switch back without a fetch.
  const dailyRef = useRef<Lick | null>(null);

  const startPrefetch = useCallback(() => {
    const p = streamLick(randomGenre(), DEFAULT_BARS);
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
      const data = parseLick(await readJsonResponse<unknown>(res));
      const fallback = res.headers.get("X-Lick-Cache") === "fallback";
      dailyRef.current = fallback ? null : data;
      setLick(fallback ? FALLBACK_LICK : data);
      setIsDaily(!fallback);
      if (fallback) setError("Couldn't load today's lick. Showing a practice lick instead.");
      setNotesPending(false);
    } catch (err) {
      setError(reportLickError(err, "daily"));
      setLick(FALLBACK_LICK);
      setIsDaily(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cold-path streaming generation with progressive render.
  const streamFresh = useCallback(async () => {
    setLoading(true);
    setNotesPending(true);
    const genre = randomGenre();
    // Snapshot the currently-displayed lick so a mid-stream failure can roll
    // back instead of leaving sheet music paired with stale/partial notes.
    let prevLick = FALLBACK_LICK;
    setLick((cur) => { prevLick = cur; return cur; });
    try {
      const full = await streamLick(genre, DEFAULT_BARS, (partial) => {
        setLick((prev) => ({ ...prev, ...partial }));
      });
      setLick(full);
      setIsDaily(false);
      setNotesPending(false);
    } catch (err) {
      // Roll back to the last complete lick so we never show a half-streamed
      // sheet with mismatched notes or an enabled Play button.
      setLick(prevLick);
      setError(reportLickError(err, "new"));
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
      try {
        const data = await pending;
        setLick(data);
        setIsDaily(false);
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

  const selectLick = useCallback((next: Lick) => {
    setError(null);
    setLick(next);
    setIsDaily(false);
    setNotesPending(false);
  }, []);

  const showDaily = useCallback(() => {
    if (!dailyRef.current) {
      void fetchDaily();
      return;
    }
    setError(null);
    setLick(dailyRef.current);
    setIsDaily(true);
    setNotesPending(false);
  }, [fetchDaily]);

  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    fetchDaily().then(() => startPrefetch());
  }, [fetchDaily, startPrefetch]);

  return { lick, loading, error, newLick, isDaily, notesPending, selectLick, showDaily };
}
