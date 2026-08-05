"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "uploading" | "done" | "error";

/**
 * Records THIS user's own microphone, locally, and uploads it after the call.
 *
 * Not the mixed call audio, and not a server-side capture of the peer
 * connection. Three reasons, and they compound:
 *
 *  1. One speaker per file means there is no diarization step. A
 *     mis-attributed turn would mean being scored on your partner's grammar,
 *     which is not a defect you can apologise your way out of.
 *  2. This audio never went through the lossy network path, so it is the best
 *     recording of you that exists — better word error rate, better
 *     pronunciation scoring.
 *  3. It costs nothing. Pulling per-participant tracks server-side means an
 *     SFU in the media path, billed per participant-minute, for a call that
 *     needs no mixing at all.
 */
export function useOwnMicRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);

  const start = useCallback((stream: MediaStream) => {
    if (recorderRef.current) return;

    try {
      // Opus in WebM is what every browser that matters records natively.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });

      // A timeslice means a crashed tab still leaves most of the audio behind.
      recorder.start(5_000);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setStatus("recording");
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start recording.",
      );
    }
  }, []);

  /** Stop, then upload. Returns true only if the upload was accepted. */
  const stopAndUpload = useCallback(
    async (sessionId: string, profileId: string): Promise<boolean> => {
      const recorder = recorderRef.current;
      if (!recorder) return false;

      const blob = await new Promise<Blob>((resolve) => {
        recorder.addEventListener(
          "stop",
          () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType })),
          { once: true },
        );
        recorder.stop();
      });

      recorderRef.current = null;
      const durationMs = startedAtRef.current
        ? Date.now() - startedAtRef.current
        : 0;
      startedAtRef.current = null;

      if (blob.size === 0) {
        setStatus("error");
        setErrorMessage("Nothing was recorded.");
        return false;
      }

      setStatus("uploading");

      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/audio`,
          {
            method: "POST",
            headers: {
              "content-type": blob.type || "audio/webm",
              "x-profile-id": profileId,
              "x-duration-ms": String(durationMs),
            },
            body: blob,
          },
        );

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Upload failed (${response.status})`);
        }

        setStatus("done");
        return true;
      } catch (error: unknown) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Could not upload the recording.",
        );
        return false;
      }
    },
    [],
  );

  /** Abandon without uploading — used when a call ends before it really began. */
  const discard = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
    setStatus("idle");
  }, []);

  return { status, errorMessage, start, stopAndUpload, discard };
}
