import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Tones are semantic, not decorative. `live` means connected, `partner` means
 * the other person, `warn` means something is running out. Never pick one for
 * how it looks.
 */
type BadgeTone = "neutral" | "live" | "partner" | "accent" | "warn";

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className, ...rest }: Props) {
  return (
    <span
      className={cn(
        "badge t-micro",
        tone !== "neutral" && `badge--${tone}`,
        className,
      )}
      {...rest}
    />
  );
}
