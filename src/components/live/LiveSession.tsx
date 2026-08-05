"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CallView } from "./CallView";
import { CountdownView } from "./CountdownView";
import { ProposalView } from "./ProposalView";
import { QueueView } from "./QueueView";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useMatchmaker } from "@/hooks/useMatchmaker";
import { useMicLevels } from "@/hooks/useMicLevels";
import { useWebRtcAudio } from "@/hooks/useWebRtcAudio";
import { SESSION_SECONDS } from "@/lib/domain";
import type { QueueProfile } from "@/lib/matchmaker-protocol";

type Props = {
  profile: QueueProfile;
  matchmakerUrl: string;
  stunUrls: string[];
};

const COUNTDOWN_SECONDS = 3;

/**
 * Owns the socket for the whole practice session.
 *
 * The queue and the call are one route on purpose: navigating between them
 * would tear down the WebSocket at precisely the moment it is carrying the
 * WebRTC negotiation.
 */
export function LiveSession({ profile, matchmakerUrl, stunUrls }: Props) {
  const router = useRouter();
  const mic = useMicLevels({ bars: 5 });

  const [isCallOpen, setIsCallOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(SESSION_SECONDS);

  const iceServers = useMemo<RTCIceServer[]>(
    () => [{ urls: stunUrls }],
    [stunUrls],
  );

  const receiveSignalRef = useRef<((payload: unknown) => void) | null>(null);

  const handleSignal = useCallback((payload: unknown) => {
    receiveSignalRef.current?.(payload);
  }, []);

  const handlePeerLeft = useCallback(() => {
    setIsCallOpen(false);
    setCallStartedAt(null);
  }, []);

  const matchmaker = useMatchmaker({
    profile,
    url: matchmakerUrl,
    onSignal: handleSignal,
    onPeerLeft: handlePeerLeft,
  });

  const webrtc = useWebRtcAudio({
    isOfferer: matchmaker.state.isOfferer,
    localStream: isCallOpen ? mic.stream : null,
    sendSignal: matchmaker.signal,
    iceServers,
  });

  /*
   * The socket hook and the WebRTC hook each need the other, so one side goes
   * through a ref. Assigned in an effect, not during render.
   */
  useEffect(() => {
    receiveSignalRef.current = webrtc.receiveSignal;
  }, [webrtc.receiveSignal]);

  const { phase } = matchmaker.state;
  const { enqueue } = matchmaker;

  /** Join the queue as soon as the socket is up. */
  useEffect(() => {
    if (phase === "idle" && !isCallOpen) enqueue();
  }, [phase, isCallOpen, enqueue]);

  /** Countdown for the call itself. */
  useEffect(() => {
    if (callStartedAt === null) return;

    const update = () => {
      const elapsed = Math.floor((Date.now() - callStartedAt) / 1000);
      setSecondsRemaining(Math.max(0, SESSION_SECONDS - elapsed));
    };

    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [callStartedAt]);

  const handleLeave = useCallback(() => {
    matchmaker.leave();
    webrtc.close();
    setIsCallOpen(false);
    setCallStartedAt(null);
    router.push("/practice");
  }, [matchmaker, webrtc, router]);

  const handleToggleMute = useCallback(() => {
    const track = mic.stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, [mic.stream]);

  /** The mic has to be live before the call opens, whatever happened earlier. */
  const openCall = useCallback(async () => {
    const stream = mic.stream ?? (await mic.start());
    if (!stream) return;
    setIsCallOpen(true);
    setCallStartedAt(Date.now());
  }, [mic]);

  if (matchmaker.state.errorMessage) {
    return (
      <Card className="p-6">
        <p className="t-title-3 mb-2">The matchmaker turned us away</p>
        <p className="t-body mb-5 text-ink-muted">
          Reason: {matchmaker.state.errorMessage}
        </p>
        <Button variant="secondary" onClick={() => router.push("/practice")}>
          Back
        </Button>
      </Card>
    );
  }

  if (phase === "connecting" || phase === "offline") {
    return (
      <Card className="p-6">
        <p className="t-title-3 mb-2">
          {phase === "offline" ? "Reconnecting…" : "Connecting…"}
        </p>
        <p className="t-body text-ink-muted">
          {phase === "offline"
            ? "Lost the connection to the matchmaker. Trying again."
            : "Opening a line to the matchmaker."}
        </p>
      </Card>
    );
  }

  if (isCallOpen && matchmaker.state.topic && matchmaker.state.partner) {
    return (
      <CallView
        topic={matchmaker.state.topic}
        partner={matchmaker.state.partner}
        displayName={profile.displayName}
        secondsRemaining={secondsRemaining}
        callStatus={webrtc.status}
        isRelayed={webrtc.isRelayed}
        localLevels={mic.levels}
        remoteStream={webrtc.remoteStream}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onLeave={handleLeave}
      />
    );
  }

  if (phase === "matched" && matchmaker.state.topic && matchmaker.state.partner) {
    return (
      <CountdownView
        partner={matchmaker.state.partner}
        topic={matchmaker.state.topic}
        seconds={COUNTDOWN_SECONDS}
        onDone={() => void openCall()}
      />
    );
  }

  if (phase === "proposed" && matchmaker.state.partner) {
    return (
      <ProposalView
        partner={matchmaker.state.partner}
        isWaitingForPartner={matchmaker.state.proposalId === null}
        onAccept={() => {
          if (matchmaker.state.proposalId) {
            matchmaker.accept(matchmaker.state.proposalId);
          }
        }}
        onDecline={() => {
          matchmaker.cancel();
          router.push("/practice");
        }}
      />
    );
  }

  return (
    <QueueView
      waitingSince={matchmaker.state.waitingSince}
      othersWaiting={matchmaker.state.othersWaiting}
      isAiOffered={matchmaker.state.isAiOffered}
      requeueReason={matchmaker.state.lastRequeueReason}
      micLevels={mic.levels}
      micStatus={mic.status}
      micError={mic.errorMessage}
      onStartMic={() => void mic.start()}
      onCancel={() => {
        matchmaker.cancel();
        router.push("/practice");
      }}
      onUseAiPartner={() => router.push("/practice?ai=pending")}
    />
  );
}
