"use client";

import { useEffect, useState } from "react";
import { Console } from "@/components/console/Console";
import { Telemetry, TelemetryRow } from "@/components/console/Telemetry";
import { Card } from "@/components/ui/Card";
import type { PartnerSummary, Topic } from "@/lib/matchmaker-protocol";

type Props = {
  partner: PartnerSummary;
  topic: Topic;
  seconds: number;
  onDone: () => void;
};

/**
 * Three seconds between "matched" and a live microphone.
 *
 * Dropping two strangers straight onto an open mic is how you get four seconds
 * of "hello? can you hear me?" at the start of a five-minute session. The
 * topic is on screen for the whole countdown, so the first thing either of
 * them says is about the topic.
 */
export function CountdownView({ partner, topic, seconds, onDone }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onDone]);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <Console label="Standing by" className="mb-5">
        <Telemetry className="mb-6">
          <TelemetryRow label="Partner" value={partner.displayName} />
          <TelemetryRow label="Mic" value="opens at zero" tone="dim" />
          <TelemetryRow
            label="On air in"
            value={`${Math.max(0, remaining)}s`}
            tone="live"
          />
        </Telemetry>

        <p className="t-body mb-3 text-ink-muted">
          You and {partner.displayName} are on in
        </p>
        <p
          className="t-timer tabular-nums text-accent-ink"
          aria-live="polite"
        >
          {Math.max(0, remaining)}
        </p>
      </Console>

      <Card tone="topic" className="p-6 pl-7">
        <p className="t-micro mb-3 text-ink-muted">Your topic</p>
        <p className="t-title-2 mb-4">{topic.prompt}</p>
        <ul className="space-y-1">
          {topic.nudges.map((nudge) => (
            <li key={nudge} className="t-caption text-ink-muted">
              · {nudge}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
