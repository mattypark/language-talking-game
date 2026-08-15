"use client";

import { useEffect, useState } from "react";

/**
 * How many people are waiting, in body type rather than the hero's face.
 *
 * Same honesty rule as the hero's version: a real number including zero, never
 * invented traffic. The wording carries the difference — "nobody waiting right
 * now" plus what happens anyway is more reassuring than a bare 0, and it is
 * still true.
 */
export function LivePresence() {
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/rooms?cohorts=&language=en");
        if (!response.ok) return;
        const body = (await response.json()) as { waiting?: number };
        if (typeof body.waiting === "number") setWaiting(body.waiting);
      } catch {
        // Keep the last known figure rather than flickering.
      }
    };

    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (waiting === null) return null;

  return (
    <p className="t-body flex items-baseline gap-3 text-ink-muted" role="status">
      <span
        className="inline-block size-[8px] shrink-0 self-center rounded-full"
        style={{ background: waiting > 0 ? "var(--live)" : "var(--ink-subtle)" }}
        aria-hidden="true"
      />
      {waiting > 0 ? (
        <span>
          <span className="tabular text-ink">{waiting}</span> waiting to be
          matched right now.
        </span>
      ) : (
        <span>
          Nobody waiting this second. An AI partner takes the call if the queue
          stays empty, and tells you that&rsquo;s what happened.
        </span>
      )}
    </p>
  );
}
