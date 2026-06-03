import { useState, useCallback, useEffect, useRef } from "react";
import type { Lick, Genre } from "../types/lick";
import { FALLBACK_LICK } from "../utils/mock-lick";

const ALL_GENRES: Genre[] = ["jazz", "blues", "funk", "rnb", "bossa"];
const DEFAULT_BARS = 4;

function randomGenre(): Genre {
  return ALL_GENRES[Math.floor(Math.random() * ALL_GENRES.length)];
}

async function generateLick(genre: Genre, bars: number): Promise<Lick> {
  const res = await fetch("/api/random", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ genre, bars }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Lick;
}

interface UseLickReturn {
  lick: Lick;
  loading: boolean;
  error: string | null;
  fetchDaily: () => Promise<void>;
  newLick: () => Promise<void>;
  isDaily: boolean;
}

export function useLick(): UseLickReturn {
  const [lick, setLick] = useState<Lick>(FALLBACK_LICK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDaily, setIsDaily] = useState(true);

  // Background-prefetched next lick (random genre), so "New Lick" is instant.
  const prefetchRef = useRef<Promise<Lick> | null>(null);
  // Guard the mount fetch against React Strict Mode's double-invoke in dev.
  const initialFetchRef = useRef(false);

  // Kick off a background fetch for the next random lick.
  const startPrefetch = useCallback(() => {
    const p = generateLick(randomGenre(), DEFAULT_BARS);
    // Swallow the rejection here so an unconsumed prefetch never triggers an
    // unhandled-rejection warning; newLick still catches it when it awaits `p`.
    p.catch(() => {
      // Drop a failed prefetch so the next request retries fresh.
      if (prefetchRef.current === p) prefetchRef.current = null;
    });
    prefetchRef.current = p;
  }, []);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/daily");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Lick = await res.json();
      setLick(data);
      setIsDaily(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch daily lick");
      setLick(FALLBACK_LICK);
      setIsDaily(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Swap in the prefetched lick instantly; if none is ready yet, await a fresh one.
  const newLick = useCallback(async () => {
    setError(null);
    const pending = prefetchRef.current;
    prefetchRef.current = null;

    if (pending) {
      // Prefetch in flight or done. If it's already resolved this is instant;
      // otherwise show loading until it lands.
      setLoading(true);
      try {
        const data = await pending;
        setLick(data);
        setIsDaily(false);
      } catch {
        // Prefetch failed — fall back to a fresh blocking fetch.
        try {
          const data = await generateLick(randomGenre(), DEFAULT_BARS);
          setLick(data);
          setIsDaily(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to generate lick");
        }
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const data = await generateLick(randomGenre(), DEFAULT_BARS);
        setLick(data);
        setIsDaily(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate lick");
      } finally {
        setLoading(false);
      }
    }

    // Queue up the next one in the background.
    startPrefetch();
  }, [startPrefetch]);

  // Fetch daily lick on mount, then warm the prefetch cache for the first "New Lick".
  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    fetchDaily().then(() => startPrefetch());
  }, [fetchDaily, startPrefetch]);

  return { lick, loading, error, fetchDaily, newLick, isDaily };
}
