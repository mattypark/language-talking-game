"use client";

import { useEffect, useState } from "react";

/**
 * How many people are actually here.
 *
 * A real number from the matchmaker or nothing at all. A fabricated "1,200
 * people online" is the kind of lie users eventually catch, and once they do
 * they stop believing the score too — which is the only thing this product
 * sells.
 */
export function HeroPresence() {
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/rooms?cohorts=&language=en");
        if (!response.ok) return;
        const body = (await response.json()) as { waiting?: number };
        setWaiting(typeof body.waiting === "number" ? body.waiting : null);
      } catch {
        // Leave the last known figure rather than flickering to nothing.
      }
    };

    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const line =
    waiting === null
      ? "Checking who's around…"
      : waiting === 0
        ? "Nobody on air yet — be the first today"
        : `${waiting} ${waiting === 1 ? "person" : "people"} on air right now`;

  return (
    <p className="stage__mark flex items-center gap-2 normal-case">
      <span
        className="inline-block size-[6px] shrink-0 rounded-full"
        style={{
          background: waiting ? "var(--live)" : "var(--stage-ink-dim)",
        }}
        aria-hidden="true"
      />
      {line}
    </p>
  );
}
