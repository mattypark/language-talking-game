import { cn } from "@/lib/cn";

type Props = {
  /** One value per bar, 0–1. Real amplitude only — never a synthetic loop. */
  levels: readonly number[];
  className?: string;
};

const MIN_SCALE = 0.08;

/**
 * Motion 6. The only continuously moving element in the product, allowed
 * because every frame is measured microphone amplitude. Silence renders as a
 * flat line, which is the point — a decorative idle shimmer would lie about
 * whether the mic is working.
 *
 * Color comes from `currentColor`, so the caller decides whether these bars
 * mean "you" (accent) or "them" (partner).
 */
export function Waveform({ levels, className }: Props) {
  return (
    <div className={cn("waveform", className)} aria-hidden="true">
      {levels.map((level, i) => (
        <span
          key={i}
          className="waveform__bar"
          style={{
            height: "100%",
            transform: `scaleY(${Math.max(MIN_SCALE, Math.min(1, level))})`,
          }}
        />
      ))}
    </div>
  );
}
