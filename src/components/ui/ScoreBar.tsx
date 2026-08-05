"use client";

import { useEffect, useState } from "react";

type Props = {
  label: string;
  /** 0–100. */
  value: number;
  /** Position in the group, used only to stagger the reveal. */
  index?: number;
};

const STAGGER_MS = 60;

/**
 * Motion 5. Fills once, on mount, then never moves again.
 *
 * A weak trait renders as an UNFILLED track — never a red fill. Red on a
 * learner's own speech is how you lose the learner, and a low bar already
 * reads as low without borrowing the destructive color.
 */
export function ScoreBar({ label, value, index = 0 }: Props) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), index * STAGGER_MS);
    return () => clearTimeout(timer);
  }, [value, index]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="t-label">{label}</span>
        <span className="tabular t-caption text-ink-muted">{value}</span>
      </div>
      <div
        className="score-bar__track"
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="score-bar__fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
