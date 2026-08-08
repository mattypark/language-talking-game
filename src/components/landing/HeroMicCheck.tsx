"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useMicLevels } from "@/hooks/useMicLevels";

const BARS = 17;
const MAX_HEIGHT = 56;

/**
 * The mic check — the instrument, with nothing around it.
 *
 * No container, no label. A wide array of hairline bars sitting directly on
 * the stage, which reads as a level meter because that is exactly what it is.
 * Hovering lifts the idle silhouette rather than animating on its own, so it
 * invites a click without ever moving unprompted.
 *
 * Live, it shows real amplitude in Claude orange. Nothing is recorded and
 * nothing is sent — it only reads the level.
 */
export function HeroMicCheck() {
  const [isHovered, setIsHovered] = useState(false);
  const mic = useMicLevels({ bars: BARS });

  const isLive = mic.status === "live";

  /** A shallow arc at rest, lifted on hover. */
  const idleHeight = (index: number) => {
    const fromCentre = Math.abs(index - (BARS - 1) / 2) / ((BARS - 1) / 2);
    const base = 1 - fromCentre * 0.72;
    return Math.round((isHovered ? 26 : 16) * base + 4);
  };

  return (
    <button
      type="button"
      className={cn("mic-check", isLive && "mic-check--live")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => (isLive ? mic.stop() : void mic.start())}
      aria-pressed={isLive}
      aria-label={isLive ? "Stop the microphone check" : "Check your microphone"}
      title={isLive ? "Listening — nothing is recorded" : "Check your microphone"}
    >
      <span
        className="flex items-center gap-[4px]"
        style={{ height: MAX_HEIGHT }}
        aria-hidden="true"
      >
        {Array.from({ length: BARS }, (_, i) => (
          <span
            key={i}
            className="mic-check__bar"
            style={{
              height: isLive
                ? `${Math.max(4, Math.min(MAX_HEIGHT, (mic.levels[i] ?? 0) * MAX_HEIGHT * 1.6))}px`
                : `${idleHeight(i)}px`,
            }}
          />
        ))}
      </span>
    </button>
  );
}
