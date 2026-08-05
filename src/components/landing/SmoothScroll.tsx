"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Smooth scrolling, on the landing page only.
 *
 * Not applied to the product. Inside a call or a report, hijacking the scroll
 * wheel would put a layer of interpretation between someone and information
 * they are trying to read quickly.
 *
 * Disabled entirely under prefers-reduced-motion — smooth scrolling is exactly
 * the kind of continuous movement that setting exists to stop.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ duration: 0.9 });
    let frame = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
