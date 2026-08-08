"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeroMicCheck } from "./HeroMicCheck";
import { HeroPresence } from "./HeroPresence";

const HERO_PHOTO = "/hero.jpg";

const NAV = [
  { label: "Start", href: "/welcome", isCurrent: true },
  { label: "How it works", href: "/welcome#what-happens" },
  { label: "Rooms", href: "/welcome#languages" },
  { label: "Set up", href: "/join" },
];

/**
 * The hero.
 *
 * Enormous hairline-weight display type laid over a dark full-bleed image,
 * words overlapping each other and the picture, with the navigation sitting on
 * a single hairline rule cut through the middle of it.
 *
 * The effect depends entirely on weight contrast: letterforms at 300 across a
 * heavy photograph. Any more weight and it collapses into an ordinary hero, so
 * the display face here is deliberately lighter than anything else in the
 * product.
 *
 * The three words are the product's own loop — you listen, you are on air, you
 * speak — rather than decoration.
 */
export function HeroStage() {
  const [hasPhoto, setHasPhoto] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(HERO_PHOTO, { method: "HEAD" });
        if (!cancelled && response.ok) setHasPhoto(true);
      } catch {
        // Composed backdrop stays. Nothing to report.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="stage flex h-[100svh] min-h-[34rem] flex-col">
      <div
        className={`stage__backdrop${hasPhoto ? " stage__backdrop--photo" : ""}`}
        style={
          hasPhoto
            ? ({ "--stage-photo": `url(${HERO_PHOTO})` } as React.CSSProperties)
            : undefined
        }
        aria-hidden="true"
      />
      <div className="stage__scrim" aria-hidden="true" />

      {/* The mic check, in the corner the composition leaves empty. */}
      <div className="absolute top-5 right-5 z-10 md:top-8 md:right-8">
        <HeroMicCheck />
      </div>

      {/* Top word, bled off the left edge exactly as the reference does. */}
      <div className="relative flex-1">
        <p
          className="stage__word absolute -left-[0.06em] top-[6%]"
          style={{ fontSize: "clamp(4rem, 17vw, 15rem)" }}
        >
          listen
        </p>

        {/*
          The wordmark, overlapping the word above it. The overlap is the whole
          idea — it is what stops this reading as a stack of headlines.
        */}
        <h1
          className="stage__word absolute left-[22%] top-[26%]"
          style={{ fontSize: "clamp(4rem, 17vw, 15rem)" }}
        >
          On&nbsp;Air
        </h1>
      </div>

      {/* The rule, with the navigation sitting on it. */}
      <nav className="stage__rule relative mx-5 shrink-0 md:mx-8" aria-label="Main">
        <ul className="flex items-center justify-between gap-4 py-3">
          {NAV.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="stage__nav-link flex items-center gap-2">
                {item.isCurrent ? (
                  <span
                    className="inline-block size-[6px] rounded-full bg-stage-ink"
                    aria-hidden="true"
                  />
                ) : null}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="relative flex-1">
        {/* Bottom word, bled off the right edge. */}
        <p
          className="stage__word absolute -right-[0.04em] bottom-[6%]"
          style={{ fontSize: "clamp(4rem, 17vw, 15rem)" }}
        >
          speak
        </p>

        <div className="absolute bottom-6 left-5 flex flex-col gap-2 md:left-8">
          <HeroPresence />
          <p className="stage__mark">© 2026</p>
        </div>
      </div>
    </section>
  );
}
