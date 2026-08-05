"use client";

import { useEffect, useState } from "react";

/**
 * Whole seconds since a timestamp, ticking once a second.
 *
 * Recomputed from the wall clock on every tick rather than counted up, so a
 * backgrounded tab whose timers get throttled still shows the right number
 * when it comes back.
 *
 * The first value is written on the next animation frame rather than during
 * the effect. Reading `Date.now()` during render is impure, and writing state
 * synchronously inside an effect cascades a second render — React 19 rejects
 * both, and it is right to.
 */
export function useElapsed(since: number | null): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (since === null) {
      const reset = requestAnimationFrame(() => setSeconds(0));
      return () => cancelAnimationFrame(reset);
    }

    const compute = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - since) / 1000)));

    const first = requestAnimationFrame(compute);
    const timer = setInterval(compute, 1000);

    return () => {
      cancelAnimationFrame(first);
      clearInterval(timer);
    };
  }, [since]);

  return seconds;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
