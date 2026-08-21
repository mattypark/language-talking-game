"use client";

import { useEffect, useState } from "react";

export type RoomStatus = {
  /** null while the first answer is still in flight. */
  isAwake: boolean | null;
  waiting: number;
  connected: number;
  liveSessions: number;
};

const POLL_MS = 5000;

/**
 * Is the matchmaker up, and who is on it.
 *
 * Called the moment an entry screen renders, and that timing is the point: a
 * free-tier host stops an idle service, so the first visitor of the day pays a
 * cold start. Paying it while they are still choosing a language costs nothing,
 * whereas paying it after they press the button looks like a broken product.
 *
 * Every number here is measured. Zero is displayed as zero.
 */
export function useRoomStatus(): RoomStatus {
  const [status, setStatus] = useState<RoomStatus>({
    isAwake: null,
    waiting: 0,
    connected: 0,
    liveSessions: 0,
  });

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/matchmaker/wake", {
          cache: "no-store",
        });
        const body = (await response.json()) as Partial<RoomStatus> & {
          awake?: boolean;
        };
        if (isCancelled) return;

        setStatus({
          isAwake: response.ok && body.awake === true,
          waiting: body.waiting ?? 0,
          connected: body.connected ?? 0,
          liveSessions: body.liveSessions ?? 0,
        });
      } catch {
        if (!isCancelled) setStatus((s) => ({ ...s, isAwake: false }));
      }
    };

    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      isCancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  return status;
}
