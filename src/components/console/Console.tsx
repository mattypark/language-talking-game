import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** The equipment label sat on the top border. Kept short — it is a channel
   * name, not a sentence. */
  label?: ReactNode;
  tone?: "surface" | "sunken";
  /** Gives the corner ticks up when a primary action is on the same screen. */
  isQuiet?: boolean;
  isFlush?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * A framed panel.
 *
 * The card with a hairline border is still the resting container for content.
 * This is its instrument-panel sibling: same border, same surface, plus corner
 * ticks and a label on the edge. It is used where the screen is reporting
 * state — the queue, the call, the launch screen — rather than where it is
 * presenting prose.
 */
export function Console({
  label,
  tone = "surface",
  isQuiet = false,
  isFlush = false,
  className,
  children,
}: Props) {
  return (
    <section
      className={cn(
        "console",
        tone === "sunken" && "console--sunken",
        isQuiet && "console--quiet",
        isFlush && "console--flush",
        className,
      )}
    >
      {label ? <span className="console__label">{label}</span> : null}
      {children}
    </section>
  );
}
