"use client";

import { useEffect, useRef, useState } from "react";
import { Console } from "@/components/console/Console";
import { Telemetry, TelemetryRow } from "@/components/console/Telemetry";
import { Button } from "@/components/ui/Button";
import { LEVEL_BANDS } from "@/lib/domain";
import type { PartnerSummary } from "@/lib/matchmaker-protocol";

type Props = {
  partner: PartnerSummary;
  /** Server clock, so it is treated as a hint rather than as truth. */
  expiresAt: number | null;
  isWaitingForPartner: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/** The service tears a proposal down after this long. Mirrored, not owned. */
const PROPOSAL_SECONDS = 12;

/**
 * Match found. The one moment in the product that earns emphasis motion — the
 * panel arrives once, at 320ms, and nothing else on screen moves.
 *
 * Both sides must say yes. That is what stops one person being dropped into a
 * live call with someone who already wandered off, and it is why the clock is
 * on screen: an unanswered proposal costs you your place, so the deadline is a
 * fact you are entitled to see rather than a surprise.
 */
export function ProposalView({
  partner,
  expiresAt,
  isWaitingForPartner,
  onAccept,
  onDecline,
}: Props) {
  const band = LEVEL_BANDS.find((b) => b.id === partner.levelBand);
  const remaining = useProposalCountdown(expiresAt);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <Console label="Match found" className="enter mb-5">
        <Telemetry className="mb-6">
          <TelemetryRow label="Partner" value={partner.displayName} />
          <TelemetryRow
            label="Level"
            value={`${band?.label ?? partner.levelBand} · ${band?.cefr ?? ""}`}
            tone="dim"
          />
          <TelemetryRow
            label="Answer within"
            value={`${remaining}s`}
            tone={remaining <= 4 ? "warn" : "dim"}
          />
        </Telemetry>

        <p className="t-display mb-2">{partner.displayName}</p>
        <p className="t-body mb-8 text-ink-muted">
          Practising the same language, at{" "}
          {band?.label.toLowerCase() ?? "your level"}. Neither of you has seen
          the topic.
        </p>

        {isWaitingForPartner ? (
          <p className="t-body text-ink-muted" role="status">
            Waiting for {partner.displayName} to accept…
          </p>
        ) : (
          <Button variant="primary" size="lg" isBlock onClick={onAccept}>
            I&rsquo;m ready
          </Button>
        )}
      </Console>

      <Button variant="ghost" isBlock onClick={onDecline}>
        Not this one
      </Button>
    </div>
  );
}

/**
 * Seconds left, counted against whichever clock is more believable.
 *
 * `expiresAt` comes off the server, and a browser whose clock is minutes out
 * would render an instant zero next to a proposal that is perfectly alive. So
 * the server value is only trusted while it lands inside the window it is
 * supposed to describe; otherwise this counts down from arrival.
 */
function useProposalCountdown(expiresAt: number | null): number {
  const arrivedAt = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const fromServer = expiresAt === null ? null : (expiresAt - now) / 1000;
  const isPlausible =
    fromServer !== null && fromServer > -1 && fromServer <= PROPOSAL_SECONDS + 2;

  const seconds = isPlausible
    ? fromServer
    : PROPOSAL_SECONDS - (now - arrivedAt.current) / 1000;

  return Math.max(0, Math.round(seconds));
}
