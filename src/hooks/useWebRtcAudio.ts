"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CallStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "closed";

/**
 * Every message carries the id of the negotiation it belongs to.
 *
 * Without it, a peer connection that gets replaced — React's development
 * double-mount, a Fast Refresh, any future renegotiation — leaves an answer in
 * flight for a connection that no longer exists. The replacement peer is also
 * waiting for an answer, cannot tell the stale one apart, applies it, and then
 * sits in "checking" forever while the other side reports "connected". The
 * only visible symptom is silence.
 */
type SignalPayload =
  | { kind: "offer"; sdp: string; nid: string }
  | { kind: "answer"; sdp: string; nid: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; nid: string };

type Options = {
  /** Exactly one side offers. The server decides, to avoid glare. */
  isOfferer: boolean;
  localStream: MediaStream | null;
  sendSignal: (payload: SignalPayload) => void;
  iceServers: RTCIceServer[];
};

/**
 * One-to-one audio over WebRTC.
 *
 * The media path is peer to peer — nothing in this product sits between two
 * people's voices. An SFU would bill per participant-minute for a call that
 * needs no mixing, no routing, and no server-side decode.
 *
 * What the server DOES need is each person's own audio for scoring, and that
 * arrives separately: each browser records its own microphone locally and
 * uploads that. One speaker per file, so there is no diarization step and no
 * chance of being scored on your partner's grammar.
 */
export function useWebRtcAudio({
  isOfferer,
  localStream,
  sendSignal,
  iceServers,
}: Options) {
  /*
   * Null until the peer connection reports something. Derived below rather
   * than set on mount, because writing state synchronously inside an effect
   * triggers a cascading render.
   */
  const [reportedStatus, setStatus] = useState<CallStatus | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isRelayed, setIsRelayed] = useState(false);

  const status: CallStatus =
    reportedStatus ?? (localStream ? "connecting" : "idle");

  const peerRef = useRef<RTCPeerConnection | null>(null);

  // Assigned in an effect, not during render — React 19 forbids the latter.
  const sendSignalRef = useRef(sendSignal);
  useEffect(() => {
    sendSignalRef.current = sendSignal;
  }, [sendSignal]);

  /**
   * ICE candidates routinely arrive before the remote description is set.
   * Adding one early throws, so they queue here until there is somewhere to
   * put them.
   */
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  /**
   * Signals can arrive before this side has a peer connection at all.
   *
   * Both browsers start their countdown independently and ask for the
   * microphone independently, so the offerer regularly has a peer — and has
   * already sent its offer — while the answerer is still waiting on
   * getUserMedia. Dropping that offer strands the call forever with no error
   * anywhere: the socket is fine, both screens look right, and no audio ever
   * arrives. So everything is buffered and drained once the peer exists.
   */
  const signalQueue = useRef<unknown[]>([]);
  const isDraining = useRef(false);

  /** Which negotiation this side currently belongs to. */
  const negotiationIdRef = useRef<string | null>(null);

  const close = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    pendingCandidates.current = [];
    setRemoteStream(null);
    setIsRelayed(false);
    setStatus("closed");
  }, []);

  useEffect(() => {
    if (!localStream) return;

    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;

    /*
     * The offerer names the negotiation; the answerer adopts the name from the
     * offer it accepts. Anything arriving under a different name belongs to a
     * peer connection that no longer exists and is dropped.
     */
    const negotiationId = crypto.randomUUID();
    if (isOfferer) {
      negotiationIdRef.current = negotiationId;
      pendingCandidates.current = [];
    }

    /*
     * Development-only handle. Lets e2e/two-person-call.mjs read real
     * getStats() to prove the media path is genuinely peer-to-peer, and lets
     * you poke at a live call from devtools. Stripped from production builds.
     */
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __onairPeer?: RTCPeerConnection }).__onairPeer =
        peer;
    }

    for (const track of localStream.getAudioTracks()) {
      peer.addTrack(track, localStream);
    }

    peer.addEventListener("track", (event) => {
      setRemoteStream(event.streams[0] ?? null);
    });

    peer.addEventListener("icecandidate", (event) => {
      if (!event.candidate) return;
      const nid = negotiationIdRef.current;
      // Before a negotiation exists there is nobody to address the candidate
      // to; the peer will re-gather once one does.
      if (!nid) return;
      sendSignalRef.current({
        kind: "ice",
        candidate: event.candidate.toJSON(),
        nid,
      });
    });

    peer.addEventListener("connectionstatechange", () => {
      switch (peer.connectionState) {
        case "connected":
          setStatus("connected");
          void reportTransport(peer, setIsRelayed);
          return;
        case "disconnected":
          setStatus("reconnecting");
          return;
        case "failed":
          setStatus("failed");
          return;
        case "closed":
          setStatus("closed");
          return;
        default:
          return;
      }
    });

    if (isOfferer) {
      void (async () => {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendSignalRef.current({
          kind: "offer",
          sdp: offer.sdp ?? "",
          nid: negotiationId,
        });
      })();
    }

    return () => {
      peer.close();
      peerRef.current = null;
    };
  }, [localStream, isOfferer, iceServers]);

  const applySignal = useCallback(
    async (peer: RTCPeerConnection, payload: unknown) => {
      if (!isSignalPayload(payload)) return;

      if (payload.kind === "offer") {
        // The answerer adopts whichever negotiation the latest offer names.
        negotiationIdRef.current = payload.nid;
        pendingCandidates.current = [];

        await peer.setRemoteDescription({ type: "offer", sdp: payload.sdp });

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendSignalRef.current({
          kind: "answer",
          sdp: answer.sdp ?? "",
          nid: payload.nid,
        });
        return;
      }

      // Anything else belonging to a negotiation we have moved on from is
      // stale by definition. Applying it is what leaves a peer stuck in
      // "checking" while the other side reports "connected".
      if (payload.nid !== negotiationIdRef.current) return;

      if (payload.kind === "answer") {
        if (peer.signalingState !== "have-local-offer") return;
        await peer.setRemoteDescription({ type: "answer", sdp: payload.sdp });
        await drainCandidates(peer, pendingCandidates.current);
        return;
      }

      if (payload.kind === "ice") {
        if (!peer.remoteDescription) {
          pendingCandidates.current.push(payload.candidate);
          return;
        }
        await peer.addIceCandidate(payload.candidate);
      }
    },
    [],
  );

  /**
   * Drained one at a time. WebRTC's signalling state is a state machine, and
   * two overlapping setRemoteDescription calls leave it in an invalid state.
   */
  const drainSignals = useCallback(async () => {
    if (isDraining.current) return;
    isDraining.current = true;

    try {
      while (signalQueue.current.length > 0 && peerRef.current) {
        await applySignal(peerRef.current, signalQueue.current.shift());
      }
    } finally {
      isDraining.current = false;
    }
  }, [applySignal]);

  /** Feed a signal that arrived over the matchmaker socket. */
  const receiveSignal = useCallback(
    (payload: unknown) => {
      signalQueue.current.push(payload);
      void drainSignals();
    },
    [drainSignals],
  );

  /** Anything buffered before this side had a peer connection. */
  useEffect(() => {
    if (peerRef.current) void drainSignals();
  }, [localStream, drainSignals]);

  return { status, remoteStream, isRelayed, receiveSignal, close };
}

async function drainCandidates(
  peer: RTCPeerConnection,
  queue: RTCIceCandidateInit[],
) {
  while (queue.length > 0) {
    const candidate = queue.shift();
    if (candidate) await peer.addIceCandidate(candidate);
  }
}

/**
 * Whether the call actually went peer to peer or fell back to a TURN relay.
 *
 * Worth knowing rather than guessing: relayed calls are the only ones that
 * cost bandwidth, and a sudden rise in the relayed share usually means an ICE
 * server is misconfigured rather than that networks changed.
 */
async function reportTransport(
  peer: RTCPeerConnection,
  setIsRelayed: (value: boolean) => void,
) {
  try {
    const stats = await peer.getStats();
    for (const report of stats.values()) {
      if (report.type !== "candidate-pair" || report.state !== "succeeded") {
        continue;
      }
      const local = stats.get(report.localCandidateId);
      setIsRelayed(local?.candidateType === "relay");
      return;
    }
  } catch {
    // Stats are diagnostic only; never let them break a working call.
  }
}

function isSignalPayload(value: unknown): value is SignalPayload {
  if (typeof value !== "object" || value === null) return false;
  const { kind, nid } = value as { kind?: unknown; nid?: unknown };
  if (typeof nid !== "string") return false;
  return kind === "offer" || kind === "answer" || kind === "ice";
}
