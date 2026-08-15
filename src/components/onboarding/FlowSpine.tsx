import { cn } from "@/lib/cn";

/**
 * One spine across three pages.
 *
 * /join, /rules and /cohort were three unrelated pages that happened to run in
 * sequence. A user could not tell how much was left, and each page restated its
 * own context from scratch. This is the single structural device that makes
 * them read as one flow: the same rule, in the same place, on all three.
 *
 * Named rather than numbered, because "2 of 3" tells you how much is left but
 * not what it is. The completed phases stay legible instead of dimming to
 * nothing — you should be able to see what you already answered.
 */
const PHASES = [
  { id: "setup", label: "Set up", aside: "About a minute" },
  { id: "expect", label: "What to expect", aside: "Read once" },
  { id: "group", label: "Your group", aside: "Then you're in" },
] as const;

export type FlowPhase = (typeof PHASES)[number]["id"];

export function FlowSpine({ current }: { current: FlowPhase }) {
  const currentIndex = PHASES.findIndex((phase) => phase.id === current);

  return (
    <nav aria-label="Setup progress" className="mb-10">
      <ol className="flex gap-px">
        {PHASES.map((phase, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={phase.id} className="flex-1">
              {/*
               * The rule carries the state. Done and current are both solid
               * ink — this is a spine, not a fuel gauge, and a step you already
               * finished has not become less true.
               */}
              <div
                className={cn(
                  "h-px",
                  isDone || isCurrent ? "bg-ink" : "bg-hairline-strong",
                )}
              />
              <p
                className={cn(
                  "t-micro pt-2",
                  isCurrent ? "text-ink" : "text-ink-subtle",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {phase.label}
              </p>
              {isCurrent ? (
                <p className="t-micro text-ink-subtle">{phase.aside}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
