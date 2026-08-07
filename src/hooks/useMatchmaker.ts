"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isServerEvent,
  type ClientEvent,
  type PartnerSummary,
  type QueueProfile,
  type ServerEvent,
  type Topic,
} from "@/lib/matchmaker-protocol";

export type MatchmakerPhase =
  | "connecting"
  | "offline"
  | "idle"
  | "queued"
  | "proposed"
  | "matched";

export type MatchmakerState = {
  phase: MatchmakerPhase;
  waitingSince: number | null;
  othersWaiting: number;
  rooms: Record<string, number>;
  proposalId: string | null;
  partner: PartnerSummary | null;
  sessionId: string | null;
  topic: Topic | null;
  isOfferer: boolean;
  isAiOffered: boolean;
  lastRequeueReason: string | null;
  errorMessage: string | null;
};

const INITIAL: MatchmakerState = {
  phase: "connecting",
  waitingSince: null,
  othersWaiting: 0,
  rooms: {},
  proposalId: null,
  partner: null,
  sessionId: null,
  topic: null,
  isOfferer: false,
  isAiOffered: false,
  lastRequeueReason: null,
  errorMessage: null,
};

const RECONNECT_DELAY_MS = 1500;

type Options = {
  profile: QueueProfile;
  url: string;
  /** WebRTC signals are handled by the call layer, not here. */
  onSignal?: (payload: unknown) => void;
  onPeerLeft?: () => void;
};

/**
 * One socket for the whole practice session — queueing and WebRTC signaling
 * are the same conversation, and a second connection would only add another
 * thing that can fall over mid-call.
 *
 * This is also why the queue and the call live under one route: navigating
 * between them would tear the socket down at the exact moment it matters.
 */
export function useMatchmaker({ profile, url, onSignal, onPeerLeft }: Options) {
  const [state, setState] = useState<MatchmakerState>(INITIAL);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  // Held in refs so a re-render never rebinds the socket and drops a signal
  // mid-negotiation. Assigned in an effect rather than during render, which
  // React 19 treats as a hard error.
  const onSignalRef = useRef(onSignal);
  const onPeerLeftRef = useRef(onPeerLeft);

  useEffect(() => {
    onSignalRef.current = onSignal;
    onPeerLeftRef.current = onPeerLeft;
  }, [onSignal, onPeerLeft]);

  const send = useCallback((event: ClientEvent) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(event));
    return true;
  }, []);

  const handleEvent = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case "ready":
        return setState((s) => ({ ...s, phase: "idle", errorMessage: null }));

      case "queued":
        return setState((s) => ({
          ...s,
          phase: "queued",
          waitingSince: event.waitingSince,
          othersWaiting: event.othersWaiting,
          rooms: event.rooms ?? {},
          proposalId: null,
          partner: null,
        }));

      case "proposed":
        return setState((s) => ({
          ...s,
          phase: "proposed",
          proposalId: event.proposalId,
          partner: event.partner,
          lastRequeueReason: null,
        }));

      case "matched":
        return setState((s) => ({
          ...s,
          phase: "matched",
          sessionId: event.sessionId,
          topic: event.topic,
          isOfferer: event.isOfferer,
          partner: event.partner,
          proposalId: null,
        }));

      case "requeued":
        return setState((s) => ({
          ...s,
          phase: "queued",
          proposalId: null,
          partner: null,
          lastRequeueReason: event.reason,
        }));

      case "ai-available":
        return setState((s) => ({ ...s, isAiOffered: true }));

      case "peer-left":
        onPeerLeftRef.current?.();
        return setState((s) => ({
          ...s,
          phase: "idle",
          sessionId: null,
          topic: null,
          partner: null,
        }));

      case "signal":
        onSignalRef.current?.(event.payload);
        return;

      case "error":
        return setState((s) => ({ ...s, errorMessage: event.reason }));

      default:
        return;
    }
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;

    const open = () => {
      if (isUnmountedRef.current) return;

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({ type: "hello", profile }));
      });

      socket.addEventListener("message", (message) => {
        const parsed: unknown = JSON.parse(message.data as string);
        if (isServerEvent(parsed)) handleEvent(parsed);
      });

      socket.addEventListener("close", () => {
        /*
         * Only reconnect if this is still the live socket.
         *
         * A close event is delivered asynchronously, so a socket we closed on
         * purpose — an unmount, a Fast Refresh, React's development
         * double-mount — fires its close handler AFTER the replacement is
         * already open. Without this guard that stale handler schedules its
         * own reconnect, and the extra socket says hello again with the same
         * profile id, taking over the server's registry entry and putting a
         * user who is mid-match back into the queue.
         */
        if (isUnmountedRef.current || socketRef.current !== socket) return;

        setState((s) => ({ ...s, phase: "offline" }));
        reconnectRef.current = setTimeout(open, RECONNECT_DELAY_MS);
      });

      // "error" is always followed by "close", so recovery lives there only.
      socket.addEventListener("error", () => socket.close());
    };

    open();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);

      // Cleared BEFORE closing, so the close handler above sees that this
      // socket is no longer the current one and stays quiet.
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
    };
  }, [url, profile, handleEvent]);

  const enqueue = useCallback(
    (choice: { language: string; topicId: string }) =>
      send({ type: "enqueue", ...choice }),
    [send],
  );
  const cancel = useCallback(() => {
    setState((s) => ({ ...s, phase: "idle", isAiOffered: false }));
    return send({ type: "cancel" });
  }, [send]);
  const accept = useCallback(
    (proposalId: string) => send({ type: "ack", proposalId }),
    [send],
  );
  const signal = useCallback(
    (payload: unknown) => send({ type: "signal", payload }),
    [send],
  );
  const leave = useCallback(() => {
    setState((s) => ({ ...s, phase: "idle", sessionId: null, topic: null }));
    return send({ type: "leave" });
  }, [send]);

  return { state, enqueue, cancel, accept, signal, leave };
}
