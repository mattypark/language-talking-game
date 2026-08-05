"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicStatus = "idle" | "requesting" | "live" | "denied" | "error";

type Options = {
  /** Number of bars to produce. */
  bars?: number;
  /** Sampling rate for the visualiser. 30fps is enough and halves the wakeups. */
  fps?: number;
};

type MicLevels = {
  levels: readonly number[];
  status: MicStatus;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
};

const DEFAULT_BARS = 5;
const DEFAULT_FPS = 30;
const FFT_SIZE = 256;
/** Bins above roughly 6kHz carry almost no speech energy; ignore them. */
const USABLE_BIN_FRACTION = 0.6;

function silence(bars: number): number[] {
  return new Array<number>(bars).fill(0);
}

/**
 * Reads the local microphone and exposes a small array of 0–1 levels for the
 * waveform. Used by the mic check in the queue and by the "you" tile in call.
 *
 * Deliberately does NOT auto-start: a page that grabs the mic on mount is
 * hostile, and browsers will reject the request outside a user gesture anyway.
 */
export function useMicLevels({
  bars = DEFAULT_BARS,
  fps = DEFAULT_FPS,
}: Options = {}): MicLevels {
  const [levels, setLevels] = useState<readonly number[]>(() => silence(bars));
  const [status, setStatus] = useState<MicStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    void contextRef.current?.close();
    contextRef.current = null;

    setLevels(silence(bars));
    setStatus("idle");
  }, [bars]);

  const start = useCallback(async () => {
    if (streamRef.current) return;

    setStatus("requesting");
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const context = new AudioContext();
      contextRef.current = context;

      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.6;
      context.createMediaStreamSource(stream).connect(analyser);

      const spectrum = new Uint8Array(analyser.frequencyBinCount);
      const usableBins = Math.floor(
        analyser.frequencyBinCount * USABLE_BIN_FRACTION,
      );
      const binsPerBar = Math.max(1, Math.floor(usableBins / bars));
      const frameInterval = 1000 / fps;
      let lastFrame = 0;

      const tick = (now: number) => {
        frameRef.current = requestAnimationFrame(tick);
        if (now - lastFrame < frameInterval) return;
        lastFrame = now;

        analyser.getByteFrequencyData(spectrum);

        const next = new Array<number>(bars);
        for (let bar = 0; bar < bars; bar += 1) {
          const from = bar * binsPerBar;
          let total = 0;
          for (let bin = from; bin < from + binsPerBar; bin += 1) {
            total += spectrum[bin] ?? 0;
          }
          next[bar] = total / binsPerBar / 255;
        }
        setLevels(next);
      };

      frameRef.current = requestAnimationFrame(tick);
      setStatus("live");
    } catch (error: unknown) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const isDenied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");

      setStatus(isDenied ? "denied" : "error");
      setErrorMessage(
        isDenied
          ? "Microphone access was blocked. Allow it in your browser settings to practice."
          : error instanceof Error
            ? error.message
            : "Could not reach the microphone.",
      );
    }
  }, [bars, fps]);

  useEffect(() => stop, [stop]);

  return { levels, status, errorMessage, start, stop };
}
