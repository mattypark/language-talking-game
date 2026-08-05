"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { attachLevelMeter, type LevelMeter } from "@/lib/level-meter";

export type MicStatus = "idle" | "requesting" | "live" | "denied" | "error";

type Options = {
  /** Number of bars to produce. */
  bars?: number;
  /** 30fps is enough for a waveform and halves the wakeups. */
  fps?: number;
};

type MicLevels = {
  levels: readonly number[];
  status: MicStatus;
  errorMessage: string | null;
  /** The live microphone track, for the call and the recorder to reuse. */
  stream: MediaStream | null;
  start: () => Promise<MediaStream | null>;
  stop: () => void;
};

const DEFAULT_BARS = 5;
const DEFAULT_FPS = 30;

function silence(bars: number): number[] {
  return new Array<number>(bars).fill(0);
}

/**
 * Reads the local microphone and exposes 0–1 levels for the waveform.
 *
 * Deliberately does NOT auto-start. A page that grabs the mic on mount is
 * hostile, and browsers reject the request outside a user gesture anyway.
 */
export function useMicLevels({
  bars = DEFAULT_BARS,
  fps = DEFAULT_FPS,
}: Options = {}): MicLevels {
  const [levels, setLevels] = useState<readonly number[]>(() => silence(bars));
  const [status, setStatus] = useState<MicStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<LevelMeter | null>(null);

  const stop = useCallback(() => {
    meterRef.current?.stop();
    meterRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    setStream(null);
    setLevels(silence(bars));
    setStatus("idle");
  }, [bars]);

  const start = useCallback(async () => {
    if (streamRef.current) return streamRef.current;

    setStatus("requesting");
    setErrorMessage(null);

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = media;
      setStream(media);
      meterRef.current = attachLevelMeter({
        stream: media,
        bars,
        fps,
        onLevels: setLevels,
      });
      setStatus("live");
      return media;
    } catch (error: unknown) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const isDenied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");

      setStatus(isDenied ? "denied" : "error");
      setErrorMessage(
        isDenied
          ? "Microphone access was blocked. Allow it in your browser settings to practise."
          : error instanceof Error
            ? error.message
            : "Could not reach the microphone.",
      );
      return null;
    }
  }, [bars, fps]);

  useEffect(() => stop, [stop]);

  return { levels, status, errorMessage, stream, start, stop };
}

/** Same measurement, for a stream you already have — the remote peer's. */
export function useStreamLevels(
  stream: MediaStream | null,
  bars = DEFAULT_BARS,
  fps = DEFAULT_FPS,
): readonly number[] {
  const [levels, setLevels] = useState<readonly number[]>(() => silence(bars));

  useEffect(() => {
    if (!stream) return;
    const meter = attachLevelMeter({ stream, bars, fps, onLevels: setLevels });
    return () => meter.stop();
  }, [stream, bars, fps]);

  // Derived rather than reset in the effect: with no stream there is nothing
  // to measure, and writing that during an effect is a cascading render.
  return stream ? levels : silence(bars);
}
