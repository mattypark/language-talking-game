"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Waveform } from "@/components/ui/Waveform";
import { formatClock, useElapsed } from "@/hooks/useElapsed";
import type { MicStatus } from "@/hooks/useMicLevels";
import { queueStatus, warmupAt } from "@/lib/warmups";

type Props = {
  waitingSince: number | null;
  othersWaiting: number;
  isAiOffered: boolean;
  requeueReason: string | null;
  micLevels: readonly number[];
  micStatus: MicStatus;
  micError: string | null;
  onStartMic: () => void;
  onCancel: () => void;
  onUseAiPartner: () => void;
};

const REQUEUE_COPY: Record<string, string> = {
  "partner-vanished": "They didn't pick up. You kept your place in the queue.",
  "partner-declined": "They passed. You kept your place in the queue.",
  "you-did-not-answer": "That one timed out. Back in the queue.",
};

export function QueueView({
  waitingSince,
  othersWaiting,
  isAiOffered,
  requeueReason,
  micLevels,
  micStatus,
  micError,
  onStartMic,
  onCancel,
  onUseAiPartner,
}: Props) {
  const seconds = useElapsed(waitingSince);
  const isMicLive = micStatus === "live";

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-8 flex items-center justify-between">
        <Badge>In the queue</Badge>
        <span className="tabular t-caption text-ink-muted">
          {formatClock(seconds)}
        </span>
      </header>

      <h1 className="t-title-1 mb-2">{queueStatus(seconds, othersWaiting)}</h1>

      {/*
        A real number or nothing at all. A fabricated "142 people practising"
        is a lie users eventually catch, and it is the kind that makes them
        distrust the score too.
      */}
      <p className="t-body mb-8 text-ink-muted">
        {othersWaiting > 0
          ? `${othersWaiting} other ${othersWaiting === 1 ? "person is" : "people are"} waiting in your groups.`
          : "You're the only one waiting in your groups right now."}
      </p>

      {requeueReason ? (
        <Card tone="sunken" className="mb-6 p-4">
          <p className="t-caption">
            {REQUEUE_COPY[requeueReason] ?? "Back in the queue."}
          </p>
        </Card>
      ) : null}

      {/*
        The mic check runs DURING the wait, not before it. It burns the dead
        time productively, it proves the app works before a stranger is
        listening, and it is real feedback rather than a spinner.
      */}
      <Card className="mb-6 p-6">
        <div className="mb-5 flex items-center gap-5">
          <div className="flex h-16 w-24 shrink-0 items-center justify-center text-accent-bright">
            <Waveform levels={micLevels} className="h-10" />
          </div>
          <div className="min-w-0">
            <p className="t-label mb-1">
              {isMicLive ? "Microphone is working" : "Check your microphone"}
            </p>
            <p className="t-caption text-ink-muted">
              {isMicLive
                ? warmupAt(seconds)
                : "Nothing is recorded here. It only reads the level."}
            </p>
          </div>
        </div>

        {isMicLive ? null : (
          <Button
            variant="secondary"
            onClick={onStartMic}
            disabled={micStatus === "requesting"}
            isBlock
          >
            {micStatus === "requesting" ? "Asking…" : "Turn on my microphone"}
          </Button>
        )}

        {micError ? (
          <p className="t-caption mt-3 text-danger">{micError}</p>
        ) : null}
      </Card>

      {/*
        Offered as a real option, not a consolation prize — and labelled
        honestly. Nobody gets quietly handed a robot.
      */}
      {isAiOffered ? (
        <Card tone="topic" className="mb-6 p-6 pl-7">
          <p className="t-title-3 mb-1">Practise with the AI examiner instead?</p>
          <p className="t-body mb-4 text-ink-muted">
            Same topic, same timer, same report at the end. It just isn&rsquo;t a
            person, and we&rsquo;d rather say so than pretend.
          </p>
          <Button variant="primary" onClick={onUseAiPartner}>
            Start with the AI
          </Button>
        </Card>
      ) : null}

      <div className="mt-auto pt-6">
        <Button variant="ghost" onClick={onCancel} isBlock>
          Leave the queue
        </Button>
      </div>
    </div>
  );
}
