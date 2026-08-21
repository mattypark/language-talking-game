"use client";

import Link from "next/link";
import { Console } from "@/components/console/Console";
import { Telemetry, TelemetryRow } from "@/components/console/Telemetry";
import { Button } from "@/components/ui/Button";
import { formatClock } from "@/hooks/useElapsed";

type Props = {
  partnerName: string | null;
  secondsSpoken: number;
  onGoAgain: () => void;
};

/**
 * The end of a guest's call.
 *
 * A member is sent to their report here, and a guest cannot be: nothing was
 * recorded, so there is nothing to score. Redirecting them to a report screen
 * that then explains itself would be exactly the bait the guest tier is
 * written to avoid.
 *
 * What is offered instead is the loop — another call, immediately — with the
 * account presented as what it actually buys rather than as a wall. The one
 * number on screen is real: how long the line was open.
 */
export function GuestEndView({ partnerName, secondsSpoken, onGoAgain }: Props) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <Console label="Off air" className="mb-5">
        <Telemetry className="mb-6">
          <TelemetryRow label="Talked to" value={partnerName ?? "your partner"} />
          <TelemetryRow
            label="Line was open"
            value={formatClock(secondsSpoken)}
            tone="dim"
          />
          <TelemetryRow label="Recorded" value="nothing" tone="dim" />
        </Telemetry>

        <h1 className="t-title-1 mb-2">That was a real conversation.</h1>
        <p className="t-body mb-6 text-ink-muted">
          Nothing of it was recorded or uploaded, which is why there is no
          report — the two are the same decision. Go again as many times as you
          like.
        </p>

        <Button variant="primary" size="lg" isBlock onClick={onGoAgain}>
          Another call
        </Button>
      </Console>

      <p className="t-caption mb-5 text-ink-muted">
        An account changes one thing: your own microphone is recorded and
        scored, and you get pace, hesitations, turn-taking and the single thing
        to fix.{" "}
        <Link href="/join" className="text-accent-ink underline underline-offset-4">
          Make one
        </Link>
        .
      </p>

      <Link href="/">
        <Button variant="ghost" isBlock>
          Done for now
        </Button>
      </Link>
    </div>
  );
}
