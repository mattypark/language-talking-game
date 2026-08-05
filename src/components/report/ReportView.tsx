"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { TRAITS, type Report } from "@/lib/scoring/types";

type Props = { sessionId: string };

type LoadState =
  | { status: "working" }
  | { status: "ready"; report: Report }
  | { status: "failed"; reason: string };

/**
 * Long enough to outlast the server's wait for the partner's upload, so a
 * slow partner never turns into a failed report.
 */
const MAX_ATTEMPTS = 24;
const RETRY_DELAY_MS = 1500;

const UNSCORED_COPY: Record<string, { title: string; body: string }> = {
  "not-enough-speech": {
    title: "Not enough speech to score",
    body: "There wasn't enough of your voice in this one to say anything useful about it. Nothing has been counted against you — try another conversation whenever you're ready.",
  },
  "not-enough-of-the-conversation": {
    title: "Not enough of the conversation",
    body: "You spoke for a small share of this one, so there isn't enough to judge fairly. Nothing has been counted against you.",
  },
};

export function ReportView({ sessionId }: Props) {
  const [state, setState] = useState<LoadState>({ status: "working" });

  /*
   * Does not reset to "working" itself — that is the initial state already,
   * and writing it synchronously from the effect below cascades a render. The
   * retry button sets it explicitly instead.
   */
  const load = useCallback(async () => {
    /*
     * Loops rather than recursing so it can retry without referring to itself
     * before it exists.
     */
    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/score`,
          { method: "POST" },
        );
        const body = (await response.json()) as {
          report?: Report;
          error?: string;
          detail?: string;
        };

        /*
         * 409 means the recording has not landed yet. Both people leave the
         * call at slightly different moments, and whoever arrives here first
         * can beat their own upload. That is a wait, not a failure — showing
         * "couldn't build your report" for a race the user can neither see nor
         * influence is the wrong answer.
         */
        if (response.status === 409 && attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }

        if (!response.ok || !body.report) {
          setState({
            status: "failed",
            reason: body.detail ?? body.error ?? "unknown",
          });
          return;
        }

        setState({ status: "ready", report: body.report });
        return;
      } catch (error: unknown) {
        setState({
          status: "failed",
          reason: error instanceof Error ? error.message : "network",
        });
        return;
      }
    }
  }, [sessionId]);

  // Deferred a tick: the linter cannot see that load() does no synchronous
  // state write, and running it out of band is correct anyway.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (state.status === "working") {
    /*
     * A calm "thinking" state rather than a spinner. Transcription plus a
     * model call takes real time, and a spinner reads as broken long before
     * the work is actually finished.
     */
    return (
      <Card className="p-8 text-center">
        <p className="t-title-3 mb-2">Listening back…</p>
        <p className="t-body text-ink-muted">
          Working through what you said. This takes a few seconds.
        </p>
      </Card>
    );
  }

  if (state.status === "failed") {
    return (
      <Card className="p-6">
        <p className="t-title-3 mb-2">Couldn&rsquo;t build your report</p>
        <p className="t-body mb-5 text-ink-muted">{state.reason}</p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setState({ status: "working" });
              void load();
            }}
          >
            Try again
          </Button>
          <Link href="/practice">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const { report } = state;
  return <ScoredReport report={report} />;
}

function ScoredReport({ report }: { report: Report }) {
  const { metrics } = report;
  const unscored = report.unscoredReason
    ? UNSCORED_COPY[report.unscoredReason]
    : null;

  return (
    <div className="space-y-6">
      {report.isDemo ? (
        <Badge tone="warn">
          Demo scoring — no API keys set, so these numbers are illustrative
        </Badge>
      ) : null}

      {/*
        Effort first, before any judgement. You always win the opening screen:
        the thing being celebrated is that you spoke, which is the behaviour
        worth repeating.
      */}
      <Card
        className="p-6"
        style={{ background: "var(--live-tint)", borderColor: "transparent" }}
      >
        <p className="t-title-2 mb-4">You spoke.</p>
        <div className="grid grid-cols-3 gap-4">
          <Stat value={formatMinutes(metrics.voicedSeconds)} label="talking" />
          <Stat value={String(metrics.totalWords)} label="words" />
          <Stat value={String(metrics.turnCount)} label="turns" />
        </div>
      </Card>

      {unscored ? (
        <Card className="p-6">
          <p className="t-title-3 mb-2">{unscored.title}</p>
          <p className="t-body text-ink-muted">{unscored.body}</p>
        </Card>
      ) : null}

      {/* One thing that went well, in their own words. */}
      {report.strength ? (
        <Card className="p-6">
          <p className="t-micro mb-3 text-ink-muted">What worked</p>
          <blockquote className="t-title-3 mb-3">
            &ldquo;{report.strength.quote}&rdquo;
          </blockquote>
          <p className="t-body text-ink-muted">{report.strength.detail}</p>
        </Card>
      ) : null}

      {/* The score, as a band with a number — never a bare number. */}
      {report.isScored && report.band ? (
        <Card className="p-6">
          <div className="mb-6 flex items-baseline justify-between">
            <p className="t-title-2">{report.band}</p>
            <p className="tabular t-title-2">{report.total}</p>
          </div>

          <div className="space-y-5">
            {report.traits.map((trait, index) => (
              <div key={trait.key}>
                <ScoreBar
                  label={TRAITS.find((t) => t.key === trait.key)?.label ?? trait.key}
                  value={trait.score}
                  index={index}
                />
                <p className="t-caption mt-2 text-ink-muted">{trait.comment}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/*
        Exactly one thing to fix, with the rule and not just the correction.
        Showing "better: I went" is a recast and teaches almost nothing;
        naming the pattern is what produces learning.
      */}
      {report.improvement ? (
        <Card tone="topic" className="p-6 pl-7">
          <p className="t-micro mb-3 text-ink-muted">One thing to fix</p>

          <p className="t-body mb-1 text-ink-muted">You said</p>
          <p className="t-title-3 mb-4">
            &ldquo;{report.improvement.original}&rdquo;
          </p>

          <p className="t-body mb-1 text-ink-muted">Better</p>
          <p className="t-title-3 mb-4">
            &ldquo;{report.improvement.corrected}&rdquo;
          </p>

          <p className="t-body">{report.improvement.rule}</p>

          {report.improvement.occurrences > 1 ? (
            <p className="t-caption mt-3 text-ink-muted">
              This came up {report.improvement.occurrences} times.
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* How it actually sounded, in numbers that move week to week. */}
      <Card tone="sunken" className="p-6">
        <p className="t-label mb-4">How it sounded</p>
        <dl className="space-y-3">
          <MetricRow
            label="Speaking pace"
            value={`${metrics.articulationRate} words/min`}
            note="while you were actually talking"
          />
          <MetricRow
            label="Run length"
            value={`${metrics.meanLengthOfRun} words`}
            note="between hesitations"
          />
          <MetricRow
            label="Fillers"
            value={`${metrics.fillerCount}`}
            note={`${metrics.fillerRate} per 100 words`}
          />
          <MetricRow
            label="Mid-sentence pauses"
            value={`${metrics.midClausePauseCount}`}
            note="usually where a word wouldn't come"
          />
          {metrics.talkShare !== null ? (
            <MetricRow
              label="Share of the talking"
              value={`${Math.round(metrics.talkShare * 100)}%`}
              note="of the time either of you spoke"
            />
          ) : null}
        </dl>
      </Card>

      {report.nextGoal ? (
        <Card className="p-6">
          <p className="t-micro mb-2 text-ink-muted">Next time</p>
          <p className="t-body-lg">{report.nextGoal}</p>
        </Card>
      ) : null}

      {/*
        The report exists to produce the next conversation, not to be admired.
      */}
      <div className="space-y-3 pt-2">
        <Link href="/practice/live" className="block">
          <Button variant="primary" size="lg" isBlock>
            Run it back
          </Button>
        </Link>
        <Link href="/practice" className="block">
          <Button variant="ghost" isBlock>
            Not now
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="tabular t-title-2">{value}</p>
      <p className="t-caption text-ink-muted">{label}</p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <dt className="t-body">{label}</dt>
        <dd className="t-caption text-ink-muted">{note}</dd>
      </div>
      <span className="tabular t-body shrink-0">{value}</span>
    </div>
  );
}

function formatMinutes(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}
