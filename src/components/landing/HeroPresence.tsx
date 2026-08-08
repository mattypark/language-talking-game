"use client";

import { useEffect, useState } from "react";

/**
 * How many people are on air, in the hero's own display face.
 *
 * A real number, always — including when it is zero. "0+" is the honest
 * placeholder rather than invented traffic: a fabricated count is the kind of
 * lie users eventually catch, and once they do they stop believing the score
 * too, which is the only thing this product sells.
 */
export function HeroPresence() {
  const [waiting, setWaiting] = useState(0);

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

  return (
    <p
      className="stage__word flex items-baseline gap-3"
      style={{ fontSize: "clamp(1.75rem, 4.4vw, 3.75rem)" }}
    >
      <span
        className="inline-block size-[10px] shrink-0 self-center rounded-full"
        style={{
          background: waiting > 0 ? "var(--stage-accent)" : "var(--stage-ink-dim)",
        }}
        aria-hidden="true"
      />
      {waiting}+ speaking
    </p>
  );
}
