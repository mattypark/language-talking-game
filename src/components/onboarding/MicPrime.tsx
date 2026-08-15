"use client";

import { useMicLevels } from "@/hooks/useMicLevels";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const BARS = 24;
const MAX_HEIGHT = 44;

/**
 * The microphone prime.
 *
 * The browser's permission dialog can only be refused once, and a refusal is
 * close to permanent — so it must never be the first thing a visitor meets.
 * This is our own UI standing in front of it: what the microphone is for, what
 * happens to the audio, and a button that is unmistakably the thing which
 * triggers the prompt.
 *
 * It is also the only piece of the product a signed-out visitor can actually
 * operate. That is deliberate: a working instrument beats a screenshot of one.
 */
export function MicPrime() {
  const mic = useMicLevels({ bars: BARS });
  const isLive = mic.status === "live";
  const isRequesting = mic.status === "requesting";

  return (
    <div className="rounded-md border border-hairline bg-surface p-6">
      <h3 className="t-title-3 mb-2">Check your microphone first</h3>
      <p className="t-body mb-5 max-w-md text-ink-muted">
        Nothing here is recorded and nothing leaves this page — the bars read the
        level and that is all they do. Do it now, so the first time a stranger is
        listening isn&rsquo;t the first time you find out you&rsquo;re muted.
      </p>

      <div
        className={cn(
          "mb-5 flex items-end gap-[3px] rounded-sm bg-sunken px-4",
          "border border-hairline",
        )}
        style={{ height: MAX_HEIGHT + 24 }}
        aria-hidden="true"
      >
        {Array.from({ length: BARS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-full",
              isLive ? "bg-accent-bright" : "bg-hairline-strong",
            )}
            style={{
              /*
               * 30fps, real amplitude only — the waveform rule. At rest the
               * bars hold a flat 3px line rather than idling, because a meter
               * that moves without input is lying about what it measures.
               */
              height: isLive
                ? `${Math.max(3, Math.min(MAX_HEIGHT, (mic.levels[i] ?? 0) * MAX_HEIGHT * 1.6))}px`
                : "3px",
              transition: "height 33ms linear",
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant={isLive ? "secondary" : "primary"}
          onClick={() => (isLive ? mic.stop() : void mic.start())}
          disabled={isRequesting}
          aria-pressed={isLive}
        >
          {isLive
            ? "Stop listening"
            : isRequesting
              ? "Waiting for permission…"
              : "Check my microphone"}
        </Button>

        {/*
         * The hook's own message when something went wrong, ours otherwise.
         * A denied microphone is not an error state to hide — it is the single
         * thing that will stop this person practising, so it gets said plainly.
         */}
        <p className="t-caption text-ink-muted" role="status">
          {mic.errorMessage
            ? mic.errorMessage
            : isLive
              ? "Say something. If the bars move, your partner will hear you."
              : "Opens your browser's permission prompt."}
        </p>
      </div>
    </div>
  );
}
