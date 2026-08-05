"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * The one signature animation in the product.
 *
 * A waveform settles into the wordmark: the bars start as a speaking level
 * meter and collapse to a flat baseline while the letters arrive. It runs once,
 * on load, and nothing else on the page moves — which is what stops it reading
 * as decoration.
 *
 * Everywhere past the landing page, motion is confined to the seven state
 * changes listed in the README. A signature moment earns an exception here
 * because it is the product's own metaphor: you speak, it resolves into
 * something you can read.
 */
const BAR_COUNT = 24;

export function OnAirMark() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const bars = container.querySelectorAll<SVGRectElement>("[data-bar]");
    const letters = container.querySelectorAll<HTMLElement>("[data-letter]");

    // Reduced motion gets the destination, not the journey.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced) {
      gsap.set(bars, { scaleY: 0.12, transformOrigin: "center" });
      gsap.set(letters, { opacity: 1, y: 0 });
      return;
    }

    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

    timeline
      .set(letters, { opacity: 0, y: 8 })
      .fromTo(
        bars,
        { scaleY: 0.12, transformOrigin: "center" },
        {
          scaleY: () => 0.25 + Math.random() * 0.75,
          duration: 0.5,
          stagger: { each: 0.012, from: "center" },
        },
      )
      .to(bars, {
        scaleY: () => 0.15 + Math.random() * 0.85,
        duration: 0.45,
        stagger: { each: 0.01, from: "edges" },
      })
      .to(bars, {
        scaleY: 0.12,
        duration: 0.6,
        stagger: { each: 0.008, from: "center" },
      })
      .to(
        letters,
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.05 },
        "-=0.35",
      );

    return () => {
      timeline.kill();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${BAR_COUNT * 8} 80`}
        className="h-16 w-[220px] text-accent-bright"
        aria-hidden="true"
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <rect
            key={i}
            data-bar
            x={i * 8 + 2}
            y={16}
            width={4}
            height={48}
            rx={2}
            fill="currentColor"
          />
        ))}
      </svg>

      <p className="t-display mt-4 flex gap-[0.02em]" aria-label="On Air">
        {"On Air".split("").map((character, index) => (
          <span key={index} data-letter aria-hidden="true">
            {character === " " ? " " : character}
          </span>
        ))}
      </p>
    </div>
  );
}
