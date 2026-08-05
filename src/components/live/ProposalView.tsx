"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LEVEL_BANDS } from "@/lib/domain";
import type { PartnerSummary } from "@/lib/matchmaker-protocol";

type Props = {
  partner: PartnerSummary;
  isWaitingForPartner: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * Match found. The one moment in the product that earns emphasis motion — the
 * card arrives once, at 320ms, and nothing else on screen moves.
 *
 * Both sides must say yes. That is what stops one person being dropped into a
 * live call with someone who already wandered off.
 */
export function ProposalView({
  partner,
  isWaitingForPartner,
  onAccept,
  onDecline,
}: Props) {
  const band = LEVEL_BANDS.find((b) => b.id === partner.levelBand);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <Card className="enter p-8 text-center">
        <p className="t-micro mb-4 text-ink-muted">Found someone</p>

        <p className="t-display mb-2">{partner.displayName}</p>
        <p className="t-body mb-8 text-ink-muted">
          {band?.label} · {band?.cefr}
        </p>

        {isWaitingForPartner ? (
          <p className="t-body text-ink-muted">
            Waiting for {partner.displayName} to accept…
          </p>
        ) : (
          <Button variant="primary" size="lg" isBlock onClick={onAccept}>
            I&rsquo;m ready
          </Button>
        )}
      </Card>

      <div className="pt-6">
        <Button variant="ghost" isBlock onClick={onDecline}>
          Not this one
        </Button>
      </div>
    </div>
  );
}
