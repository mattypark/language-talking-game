import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TelemetryTone = "default" | "live" | "warn" | "dim";

/**
 * A readout row: label, leader, value.
 *
 * Every value that appears here is measured — a queue length, a wait, a codec,
 * a connection state. Nothing invented, ever: the whole reason this panel
 * reads as instrumentation rather than as decoration is that the numbers on it
 * are real, and one fabricated "142 people practising" would make the score
 * report look invented too.
 */
export function TelemetryRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: TelemetryTone;
}) {
  return (
    <div className="telemetry__row">
      <span className="telemetry__key">{label}</span>
      <span className="telemetry__leader" aria-hidden="true" />
      <span
        className={cn(
          "telemetry__value",
          tone === "live" && "telemetry__value--live",
          tone === "warn" && "telemetry__value--warn",
          tone === "dim" && "telemetry__value--dim",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Telemetry({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("telemetry", className)}>{children}</div>;
}

/**
 * Connection strength as bars.
 *
 * Three of them, filled by count as well as by colour, because the call screen
 * has to stay readable in grayscale and "green" is not a fact anyone can see
 * on a monochrome display.
 */
export function SignalBars({
  strength,
  tone = "live",
  label,
}: {
  /** 0–3. */
  strength: number;
  tone?: "live" | "warn";
  label: string;
}) {
  return (
    <span className="signal" role="img" aria-label={label}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            "signal__bar",
            index < strength &&
              (tone === "warn" ? "signal__bar--warn" : "signal__bar--on"),
          )}
        />
      ))}
    </span>
  );
}
