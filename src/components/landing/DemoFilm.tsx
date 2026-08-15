"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";

const DEMO_SRC = "/demo.mp4";
const DEMO_POSTER = "/demo-poster.jpg";

/**
 * The walkthrough film.
 *
 * Plays `public/demo.mp4` when that file exists. When it does not — which is
 * the case until a real screen recording is dropped in — it says so plainly
 * rather than showing a play button that does nothing, or a stock mockup
 * pretending to be the product.
 *
 * Muted, looping and inline: it is illustration, not something to sit through.
 * Controls are still exposed, because a video that cannot be paused is a video
 * that cannot be read.
 *
 * The aspect ratio is declared rather than inherited from the file, so the page
 * does not reflow when metadata loads — see docs/recording-brief.md, which
 * locks the recording to 16:9 for exactly this reason. `muted`, `loop`,
 * `playsInline` and `autoPlay` together satisfy every browser's autoplay
 * policy; the poster is what shows if one refuses anyway.
 */
export function DemoFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);

  /*
   * Three states, not two. Rendering the <video> optimistically and swapping to
   * the fallback on 404 fires a real request for a file that is usually not
   * there — two console errors on every visit, plus a poster request for the
   * same nonexistent recording. Waiting for the answer costs one round trip
   * against a HEAD request and keeps the console honest, which matters because
   * e2e/onboarding.mjs fails the run on console errors.
   */
  const [state, setState] = useState<"checking" | "present" | "missing">(
    "checking",
  );

  useEffect(() => {
    // A HEAD request answers the question without downloading the file.
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(DEMO_SRC, { method: "HEAD" });
        if (!cancelled) setState(response.ok ? "present" : "missing");
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    // Reserves the exact box either outcome will occupy, so nothing shifts.
    return <div className="aspect-video w-full rounded-lg bg-sunken" />;
  }

  if (state === "missing") {
    return (
      <div className="aspect-video flex flex-col items-center justify-center rounded-lg border border-hairline bg-surface p-8 text-center">
        <Badge tone="warn" className="mb-4">
          No walkthrough recorded yet
        </Badge>
        <p className="t-body mx-auto max-w-sm text-ink-muted">
          Drop a screen recording at{" "}
          <code className="tabular text-ink">public/demo.mp4</code> and it plays
          here. Until then this space stays empty rather than showing a mockup
          of a product that already exists.
        </p>
      </div>
    );
  }

  return (
    <figure>
      <video
        ref={videoRef}
        className="aspect-video w-full rounded-lg border border-hairline bg-sunken"
        src={DEMO_SRC}
        poster={DEMO_POSTER}
        controls
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setState("missing")}
      />
      <figcaption className="t-caption mt-3 text-ink-muted">
        A full session, start to report.
      </figcaption>
    </figure>
  );
}
