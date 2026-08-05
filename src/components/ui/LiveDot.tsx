import { Badge } from "@/components/ui/Badge";

type Props = {
  /** Shown next to the dot. Status is never carried by color alone. */
  label?: string;
};

/**
 * The on-air indicator. The dot pulses; the word does not — so the state
 * survives both reduced-motion and grayscale.
 */
export function LiveDot({ label = "Live" }: Props) {
  return (
    <Badge tone="live">
      <span className="live-dot" aria-hidden="true" />
      {label}
    </Badge>
  );
}
