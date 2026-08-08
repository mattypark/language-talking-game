"use client";

import { useState } from "react";
import { useMicLevels } from "@/hooks/useMicLevels";

const IDLE_HEIGHTS = [6, 11, 16, 11, 6];
const HOVER_HEIGHTS = [9, 16, 22, 16, 9];

/**
 * The microphone check, in the top corner of the hero.
 *
 * It is the first thing this product needs from anyone, so it is offered
 * before signup rather than buried inside a call. Idle bars grow on hover —
 * enough to read as "this does something" without animating on its own.
 *
 * Once running it shows real amplitude from the real microphone. Nothing is
 * recorded and nothing is sent; it only reads the level, and it says so.
 */
export function HeroMicCheck() {
  const [isHovered, setIsHovered] = useState(false);
  const mic = useMicLevels({ bars: 5 });

  const isLive = mic.status === "live";
  const idle = isHovered ? HOVER_HEIGHTS : IDLE_HEIGHTS;

  const label =
    mic.status === "requesting"
      ? "Asking…"
      : mic.status === "denied"
        ? "Mic blocked"
        : isLive
          ? "We can hear you"
          : "Test your mic";

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        className="mic-check"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => (isLive ? mic.stop() : void mic.start())}
        aria-pressed={isLive}
      >
        <span className="flex h-6 items-center gap-[3px]" aria-hidden="true">
          {(isLive ? mic.levels : idle).map((value, i) => (
            <span
              key={i}
              className="mic-check__bar"
              style={{
                height: isLive
                  ? `${Math.max(3, Math.min(24, value * 24))}px`
                  : `${idle[i]}px`,
              }}
            />
          ))}
        </span>
        {label}
      </button>

      {isLive || mic.errorMessage ? (
        <p className="stage__mark max-w-[15rem] text-right normal-case">
          {mic.errorMessage ?? "Nothing is recorded. This only reads the level."}
        </p>
      ) : null}
    </div>
  );
}
