"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CallView } from "./CallView";
import { CountdownView } from "./CountdownView";
import { GuestEndView } from "./GuestEndView";
import { ProposalView } from "./ProposalView";
import { QueueView } from "./QueueView";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useMatchmaker } from "@/hooks/useMatchmaker";
import { useMicLevels } from "@/hooks/useMicLevels";
import { useOwnMicRecorder } from "@/hooks/useOwnMicRecorder";
import { useWebRtcAudio } from "@/hooks/useWebRtcAudio";
import { SESSION_SECONDS } from "@/lib/domain";
import type { QueueProfile } from "@/lib/matchmaker-protocol";
import {
  isVideoControl,
  type VideoControl,
  type VideoState,
} from "@/lib/video-handshake";

type Props = {
  profile: QueueProfile;
  queueToken: string;
  /**
   * Guests practise but are never recorded. Enforced on the server too — this
   * is so the recorder never runs, not so the API is trusted to say no.
   */
  isGuest: boolean;
  matchmakerUrl: string;
  stunUrls: string[];
  /** What they chose on the room screen. */
  language: string;
  topicId: string;
};

const COUNTDOWN_SECONDS = 3;

/**
 * Owns the socket for the whole practice session.
 *
 * The queue and the call are one route on purpose: navigating between them
 * would tear down the WebSocket at precisely the moment it is carrying the
 * WebRTC negotiation.
 */
export function LiveSession({
  profile,
  queueToken,
  isGuest,
  matchmakerUrl,
  stunUrls,
  language,
  topicId,
}: Props) {
  const router = useRouter();
  const mic = useMicLevels({ bars: 5 });
  const recorder = useOwnMicRecorder();

  const [isCallOpen, setIsCallOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [didPartnerLeave, setDidPartnerLeave] = useState(false);
  /*
   * A guest has no report to be sent to, so the end of a call is a screen
   * rather than a redirect — see GuestEndView. Held here because the queue
   * auto-joins the moment the socket goes idle, and without this the call
   * would dissolve straight back into a search with nothing said about it.
   */
  const [hasEndedAsGuest, setHasEndedAsGuest] = useState(false);
  const [videoState, setVideoState] = useState<VideoState>("off");
  const [secondsRemaining, setSecondsRemaining] = useState(SESSION_SECONDS);

  const iceServers = useMemo<RTCIceServer[]>(
    () => [{ urls: stunUrls }],
    [stunUrls],
  );

  const receiveSignalRef = useRef<((payload: unknown) => void) | null>(null);
  const videoControlRef = useRef<((control: VideoControl) => void) | null>(null);

  /*
   * "peer-left" clears the session id from matchmaker state, but the upload
   * that follows still needs it. Held here so the recording has somewhere to
   * go after the partner has already gone.
   */
  const lastSessionIdRef = useRef<string | null>(null);

  /**
   * Camera controls ride the same relay as the WebRTC signals, so they are
   * separated here before anything reaches the peer connection.
   */
  const handleSignal = useCallback((payload: unknown) => {
    if (isVideoControl(payload)) {
      videoControlRef.current?.(payload);
      return;
    }
    receiveSignalRef.current?.(payload);
  }, []);

  /**
   * They hung up. The conversation still happened, so this side's recording is
   * still uploaded — a partner walking out must not cost you your report.
   */
  const handlePeerLeft = useCallback(() => {
    setIsCallOpen(false);
    setCallStartedAt(null);
    setDidPartnerLeave(true);
  }, []);

  const matchmaker = useMatchmaker({
    profile,
    queueToken,
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

  useEffect(() => {
    if (matchmaker.state.sessionId) {
      lastSessionIdRef.current = matchmaker.state.sessionId;
    }
  }, [matchmaker.state.sessionId]);

  /** Survives the partner leaving, which is exactly when it is needed. */
  const lastPartnerNameRef = useRef<string | null>(null);
  useEffect(() => {
    if (matchmaker.state.partner) {
      lastPartnerNameRef.current = matchmaker.state.partner.displayName;
    }
  }, [matchmaker.state.partner]);

  const { phase } = matchmaker.state;
  const { enqueue } = matchmaker;

  /** Join the queue as soon as the socket is up, in the room they chose. */
  useEffect(() => {
    if (phase === "idle" && !isCallOpen && !hasEndedAsGuest) {
      enqueue({ language, topicId });
    }
  }, [phase, isCallOpen, hasEndedAsGuest, enqueue, language, topicId]);

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

  /**
   * Ends the call and gets this side's own recording uploaded.
   *
   * The upload is awaited before navigating: a page transition mid-POST loses
   * the audio, and a session with one track is a session nobody can be scored
   * on.
   */
  const endCall = useCallback(async () => {
    const sessionId = matchmaker.state.sessionId;

    matchmaker.leave();
    webrtc.close();
    setIsCallOpen(false);
    setCallStartedAt(null);

    if (sessionId && recorder.status === "recording") {
      await recorder.stopAndUpload(sessionId, profile.id);
    } else {
      recorder.discard();
    }

    /*
     * A guest was never recorded, so there is no report waiting at the other
     * end of a redirect. Sending them to one anyway would be the bait the
     * tier is written to avoid.
     */
    if (isGuest) {
      setHasEndedAsGuest(true);
      return;
    }

    router.push(sessionId ? `/practice/report/${sessionId}` : "/practice");
  }, [matchmaker, webrtc, recorder, profile.id, router, isGuest]);

  /**
   * The partner hung up. Their leaving does not delete the conversation that
   * already happened, so this side's recording is still uploaded and still
   * scored.
   */
  useEffect(() => {
    if (!didPartnerLeave) return;

    const sessionId = matchmaker.state.sessionId ?? lastSessionIdRef.current;
    void (async () => {
      if (sessionId && recorder.status === "recording") {
        await recorder.stopAndUpload(sessionId, profile.id);
      }
      if (isGuest) {
        setHasEndedAsGuest(true);
        return;
      }
      router.push(sessionId ? `/practice/report/${sessionId}` : "/practice");
    })();
  }, [
    didPartnerLeave,
    matchmaker.state.sessionId,
    recorder,
    profile.id,
    router,
    isGuest,
  ]);

  /**
   * Time is up. Ends itself rather than waiting for someone to notice.
   *
   * Deferred by a tick because endCall writes state immediately, and doing
   * that synchronously inside an effect cascades a second render.
   */
  useEffect(() => {
    if (!isCallOpen || secondsRemaining > 0) return;
    const timer = setTimeout(() => void endCall(), 0);
    return () => clearTimeout(timer);
  }, [isCallOpen, secondsRemaining, endCall]);

  /* ------------------------------------------------------------ camera --- */

  const startVideo = useCallback(async () => {
    const ok = await webrtc.enableVideo();
    if (!ok) {
      setVideoState("off");
      return;
    }
    setVideoState("on");

    // Only the offerer may re-offer; the other side has to ask for it.
    if (matchmaker.state.isOfferer) {
      await webrtc.renegotiate();
    } else {
      matchmaker.signal({ kind: "video-renegotiate" });
    }
  }, [webrtc, matchmaker]);

  const stopVideo = useCallback(
    (shouldTell = true) => {
      webrtc.disableVideo();
      setVideoState("off");
      if (shouldTell) matchmaker.signal({ kind: "video-stop" });

      if (matchmaker.state.isOfferer) {
        void webrtc.renegotiate();
      } else {
        matchmaker.signal({ kind: "video-renegotiate" });
      }
    },
    [webrtc, matchmaker],
  );

  /** Their side of the handshake. */
  const handleVideoControl = useCallback(
    (control: VideoControl) => {
      switch (control.kind) {
        case "video-request":
          // Only surfaces a prompt. Nothing turns on without an answer.
          setVideoState((current) => (current === "on" ? current : "invited"));
          return;
        case "video-accept":
          void startVideo();
          return;
        case "video-decline":
          setVideoState("off");
          return;
        case "video-stop":
          // They dropped their camera; ours stays exactly as it was.
          return;
        case "video-renegotiate":
          if (matchmaker.state.isOfferer) void webrtc.renegotiate();
          return;
        default:
          return;
      }
    },
    [startVideo, webrtc, matchmaker.state.isOfferer],
  );

  useEffect(() => {
    videoControlRef.current = handleVideoControl;
  }, [handleVideoControl]);

  const askForVideo = useCallback(() => {
    setVideoState("asked");
    matchmaker.signal({ kind: "video-request" });
  }, [matchmaker]);

  const acceptVideo = useCallback(() => {
    matchmaker.signal({ kind: "video-accept" });
    void startVideo();
  }, [matchmaker, startVideo]);

  const declineVideo = useCallback(() => {
    setVideoState("off");
    matchmaker.signal({ kind: "video-decline" });
  }, [matchmaker]);

  /** Report and hang up in one move. The call must stop, then be explained. */
  const handleReport = useCallback(
    (reason: string) => {
      const sessionId =
        matchmaker.state.sessionId ?? lastSessionIdRef.current;

      void (async () => {
        if (sessionId) {
          try {
            await fetch("/api/reports", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ sessionId, reason }),
            });
          } catch {
            // A failed report must still end the call — that is the urgent part.
          }
        }
        await endCall();
      })();
    },
    [matchmaker.state.sessionId, endCall],
  );

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

    const { sessionId, topic } = matchmaker.state;

    /*
     * Register the session before recording, so the upload has somewhere to
     * go. A guest never records, so there is nothing to register and nothing
     * to write — which is also what lets a guest call work on a deployment
     * with no store behind it at all.
     */
    if (sessionId && topic && !isGuest) {
      try {
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, topicId: topic.id }),
        });
      } catch {
        // A failed registration costs the report, not the conversation. Let
        // them talk; the upload will surface the problem.
      }
    }

    // A guest's audio never leaves their machine, so there is nothing to start.
    if (!isGuest) recorder.start(stream);

    setIsCallOpen(true);
    setCallStartedAt(Date.now());
  }, [mic, matchmaker.state, recorder, isGuest]);

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

  /*
   * A guest, off air. Held here rather than redirected: there is no report to
   * redirect to, and the queue would otherwise re-open a search underneath
   * them the instant the socket went idle.
   */
  if (hasEndedAsGuest) {
    return (
      <GuestEndView
        partnerName={lastPartnerNameRef.current}
        secondsSpoken={SESSION_SECONDS - secondsRemaining}
        onGoAgain={() => {
          setDidPartnerLeave(false);
          setSecondsRemaining(SESSION_SECONDS);
          setHasEndedAsGuest(false);
        }}
      />
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
        onLeave={() => void endCall()}
        onReport={handleReport}
        videoState={videoState}
        localVideo={webrtc.localVideo}
        hasRemoteVideo={webrtc.hasRemoteVideo}
        onAskForVideo={askForVideo}
        onAcceptVideo={acceptVideo}
        onDeclineVideo={declineVideo}
        onStopVideo={() => stopVideo()}
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
        expiresAt={matchmaker.state.proposalExpiresAt}
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
      onUseAiPartner={() => {
        matchmaker.cancel();
        router.push("/practice/ai");
      }}
    />
  );
}
