import { useState, useCallback } from "react";
import type { Lick, Genre } from "../types/lick";
import { FALLBACK_LICK } from "../utils/mock-lick";

interface UseLickReturn {
  lick: Lick;
  loading: boolean;
  error: string | null;
  fetchDaily: () => Promise<void>;
  fetchRandom: (genre: Genre, bars: number) => Promise<void>;
  isDaily: boolean;
}

export function useLick(): UseLickReturn {
  const [lick, setLick] = useState<Lick>(FALLBACK_LICK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDaily, setIsDaily] = useState(true);

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

  const fetchRandom = useCallback(async (genre: Genre, bars: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, bars }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Lick = await res.json();
      setLick(data);
      setIsDaily(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate lick");
    } finally {
      setLoading(false);
    }
  }, []);

  return { lick, loading, error, fetchDaily, fetchRandom, isDaily };
}
