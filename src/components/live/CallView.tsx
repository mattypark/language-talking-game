"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LiveDot } from "@/components/ui/LiveDot";
import { Sheet } from "@/components/ui/Sheet";
import { Waveform } from "@/components/ui/Waveform";
import { formatClock } from "@/hooks/useElapsed";
import { useStreamLevels } from "@/hooks/useMicLevels";
import type { CallStatus } from "@/hooks/useWebRtcAudio";
import { cn } from "@/lib/cn";
import { isSpeaking } from "@/lib/level-meter";
import type { PartnerSummary, Topic } from "@/lib/matchmaker-protocol";
import type { VideoState } from "@/lib/video-handshake";

type Props = {
  topic: Topic;
  partner: PartnerSummary;
  displayName: string;
  secondsRemaining: number;
  callStatus: CallStatus;
  isRelayed: boolean;
  localLevels: readonly number[];
  remoteStream: MediaStream | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
  onReport: (reason: string) => void;
  videoState: VideoState;
  localVideo: MediaStream | null;
  hasRemoteVideo: boolean;
  onAskForVideo: () => void;
  onAcceptVideo: () => void;
  onDeclineVideo: () => void;
  onStopVideo: () => void;
};

const WARNING_SECONDS = 30;

export function CallView({
  topic,
  partner,
  displayName,
  secondsRemaining,
  callStatus,
  isRelayed,
  localLevels,
  remoteStream,
  isMuted,
  onToggleMute,
  onLeave,
  onReport,
  videoState,
  localVideo,
  hasRemoteVideo,
  onAskForVideo,
  onAcceptVideo,
  onDeclineVideo,
  onStopVideo,
}: Props) {
  const remoteLevels = useStreamLevels(remoteStream);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const isRunningOut = secondsRemaining <= WARNING_SECONDS;
  const youAreSpeaking = !isMuted && isSpeaking(localLevels);
  const theyAreSpeaking = isSpeaking(remoteLevels);

  return (
    <div className="flex flex-1 flex-col">
      {/* The remote audio itself. Nothing to look at; it just has to play. */}
      <audio ref={audioRef} autoPlay playsInline />

      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {callStatus === "connected" ? (
            <LiveDot />
          ) : (
            <Badge tone="warn">{connectionLabel(callStatus)}</Badge>
          )}
          {isRelayed ? <Badge>Relayed</Badge> : null}
        </div>

        <span
          className={cn("t-timer", isRunningOut && "text-warn-ink")}
          aria-live="off"
        >
          {formatClock(secondsRemaining)}
        </span>
      </header>

      {/*
        The topic card is the hero of this screen, not the two faces. It is the
        only element carrying an accent, because "what do I say" is the failure
        mode that kills every peer-practice product.
      */}
      <Card tone="topic" className="mb-6 p-6 pl-7">
        <p className="t-micro mb-3 text-ink-muted">Topic</p>
        <p className="t-title-2 mb-4">{topic.prompt}</p>
        <ul className="space-y-1">
          {topic.nudges.map((nudge) => (
            <li key={nudge} className="t-caption text-ink-muted">
              · {nudge}
            </li>
          ))}
        </ul>
      </Card>

      {/*
        Cameras only appear once both people agreed. Until then this is a voice
        call and looks like one.
      */}
      {videoState === "on" ? (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <VideoTile stream={remoteStream} isLive={hasRemoteVideo} label={partner.displayName} tone="partner" />
          <VideoTile stream={localVideo} isLive={localVideo !== null} label="You" tone="you" isMuted />
        </div>
      ) : null}

      <div className="mb-6 space-y-3">
        <SpeakerTile
          name={partner.displayName}
          levels={remoteLevels}
          isActive={theyAreSpeaking}
          tone="partner"
          note={remoteStream ? undefined : "Connecting…"}
        />
        <SpeakerTile
          name={`${displayName} (you)`}
          levels={localLevels}
          isActive={youAreSpeaking}
          tone="you"
          note={isMuted ? "Muted" : undefined}
        />
      </div>

      {isRunningOut ? (
        <p className="t-caption mb-4 text-warn-ink" role="status">
          Under a minute left. Finish your thought.
        </p>
      ) : null}

      {/*
        Controls stay visible. Zoom hides them until hover; Meet does not. For a
        five-minute session with a stranger, hiding the mute button is hostile.
      */}
      <div className="mt-auto flex items-center gap-3 border-t border-hairline pt-4">
        <Button
          variant={isMuted ? "primary" : "secondary"}
          size="lg"
          onClick={onToggleMute}
          aria-pressed={isMuted}
        >
          {isMuted ? "Unmute" : "Mute"}
        </Button>

        {/*
          Leave is a ghost until it is confirmed. A red-filled button sitting
          next to an orange primary is a genuine misclick risk, and misclicking
          this one ends the session for both people.
        */}
        {videoState === "on" ? (
          <Button variant="secondary" size="lg" onClick={onStopVideo}>
            Stop video
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            onClick={onAskForVideo}
            disabled={videoState === "asked"}
          >
            {videoState === "asked" ? "Asked…" : "Video"}
          </Button>
        )}

        <Button
          variant="ghost"
          size="lg"
          onClick={() => setIsReporting(true)}
          aria-label="Report this conversation"
        >
          Report
        </Button>

        {isConfirmingLeave ? (
          <Button variant="danger" size="lg" onClick={onLeave} className="ml-auto">
            End it for both of us
          </Button>
        ) : (
          <Button
            variant="danger-ghost"
            size="lg"
            onClick={() => setIsConfirmingLeave(true)}
            className="ml-auto"
          >
            Leave
          </Button>
        )}
      </div>

      {/*
        Their request to turn cameras on. Nothing happens without an answer,
        and declining is a single tap that does not end the conversation.
      */}
      <Sheet
        isOpen={videoState === "invited"}
        onClose={onDeclineVideo}
        title={`${partner.displayName} wants to turn cameras on`}
      >
        <p className="t-body mb-5 text-ink-muted">
          You&rsquo;d both be on camera. You can turn yours off again at any
          point, on your own, without asking.
        </p>
        <div className="flex gap-3">
          <Button variant="primary" onClick={onAcceptVideo}>
            Turn my camera on
          </Button>
          <Button variant="ghost" onClick={onDeclineVideo}>
            Stay on voice
          </Button>
        </div>
      </Sheet>

      {/*
        Reporting ends the call on the spot. Nobody being harassed should have
        to stay on the line through a confirmation dialog to make it stop.
      */}
      <Sheet
        isOpen={isReporting}
        onClose={() => setIsReporting(false)}
        title="Report this conversation"
      >
        <p className="t-body mb-5 text-ink-muted">
          This ends the call straight away. The last part of the recording is
          kept so a person can review it.
        </p>
        <div className="space-y-2">
          {REPORT_REASONS.map((reason) => (
            <Button
              key={reason.id}
              variant="secondary"
              isBlock
              onClick={() => {
                setIsReporting(false);
                onReport(reason.id);
              }}
            >
              {reason.label}
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

const REPORT_REASONS = [
  { id: "harassment", label: "They were abusive" },
  { id: "sexual-content", label: "Sexual content" },
  { id: "hate-speech", label: "Hate speech" },
  { id: "contact-swapping", label: "Asking for my contacts" },
  { id: "not-practising", label: "Not here to practise" },
  { id: "safety-concern", label: "I'm worried about their safety" },
];

/**
 * A camera tile. Local video is mirrored and muted — hearing yourself is
 * unusable, and an unmirrored self-view reads as someone else's face.
 */
function VideoTile({
  stream,
  isLive,
  label,
  tone,
  isMuted = false,
}: {
  stream: MediaStream | null;
  isLive: boolean;
  label: string;
  tone: "you" | "partner";
  isMuted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div
      className={cn(
        "relative aspect-[4/3] overflow-hidden rounded-md border bg-sunken",
        tone === "partner" ? "border-partner" : "border-accent-bright",
      )}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isMuted}
        className={cn(
          "h-full w-full object-cover",
          isMuted && "[transform:scaleX(-1)]",
          !isLive && "opacity-0",
        )}
      />
      {!isLive ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="t-caption text-ink-muted">Camera off</span>
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 rounded-xs bg-surface/90 px-2 py-1">
        <span className="t-micro">{label}</span>
      </span>
    </div>
  );
}

function connectionLabel(status: CallStatus): string {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    case "failed":
      return "Connection lost";
    default:
      return "Not connected";
  }
}

type TileProps = {
  name: string;
  levels: readonly number[];
  isActive: boolean;
  tone: "you" | "partner";
  note?: string;
};

/**
 * Speaking state is carried by TWO signals — a ring and a background tint —
 * because colour alone fails WCAG 1.4.1 and this screen has to be readable in
 * grayscale.
 */
function SpeakerTile({ name, levels, isActive, tone, note }: TileProps) {
  const isPartner = tone === "partner";

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-md border p-4 transition-colors duration-100",
        isActive
          ? isPartner
            ? "border-partner bg-partner-tint"
            : "border-accent-bright bg-accent-tint"
          : "border-hairline bg-sunken",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-16 shrink-0 items-center justify-center",
          isPartner ? "text-partner" : "text-accent-bright",
        )}
      >
        <Waveform levels={levels} className="h-8" />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("t-label truncate", isActive && "font-semibold")}>
          {name}
        </p>
        {note ? <p className="t-caption text-ink-muted">{note}</p> : null}
      </div>

      {isActive ? (
        <span className="t-micro text-ink-muted">Speaking</span>
      ) : null}
    </div>
  );
}
