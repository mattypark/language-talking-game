"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LiveDot } from "@/components/ui/LiveDot";
import { Waveform } from "@/components/ui/Waveform";
import { formatClock } from "@/hooks/useElapsed";
import { useMicLevels } from "@/hooks/useMicLevels";
import { useOwnMicRecorder } from "@/hooks/useOwnMicRecorder";
import { SESSION_SECONDS } from "@/lib/domain";
import type { Topic } from "@/lib/matchmaker-protocol";

type Props = { profileId: string };

/**
 * The AI partner — the liquidity backstop.
 *
 * A random-pairing product dies of an empty queue long before it dies of load,
 * and a user who waits ninety seconds and gets nobody does not come back. This
 * makes sure that never happens: same topic, same timer, same report.
 *
 * It is labelled honestly everywhere. Nobody is quietly handed a robot.
 *
 * The turns here are scripted and spoken with the browser's own speech
 * synthesis, so it works with no API key and no cost. The upgrade path is
 * Gemini Live at roughly $0.14 for a ten-minute conversation — which is about
 * what the human path pays in transcription anyway, since the Live API returns
 * transcripts for free. That is the crucial economic fact: the AI partner is
 * not a cost penalty, so there is no reason to ration it.
 */
export function AiPartnerSession({ profileId }: Props) {
  const router = useRouter();
  const mic = useMicLevels({ bars: 5 });
  const recorder = useOwnMicRecorder();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [hasStarted, setHasStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(SESSION_SECONDS);
  const [turnIndex, setTurnIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEndingRef = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/topics");
        if (!response.ok) throw new Error("Could not load a topic");
        const body = (await response.json()) as { topics: Topic[] };
        const pick =
          body.topics[Math.floor(Math.random() * body.topics.length)] ?? null;
        setTopic(pick);
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load a topic",
        );
      }
    })();
  }, []);

  /**
   * Prompts that push for elaboration rather than yes/no answers.
   *
   * Memoised because two callbacks depend on it; a fresh array each render
   * would rebuild them, and one of those callbacks drives speech.
   */
  const turns = useMemo(
    () =>
      topic
        ? [
            `Let's talk about this. ${topic.prompt}`,
            `Interesting. ${topic.nudges[0] ?? "Can you say more about that?"}`,
            `Right. And ${topic.nudges[1] ?? "why do you think that is?"}`,
            "What would you say to someone who disagreed with you?",
            "Last one — has that always been true for you?",
          ]
        : [],
    [topic],
  );

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.addEventListener("start", () => setIsSpeaking(true));
    utterance.addEventListener("end", () => setIsSpeaking(false));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const start = useCallback(async () => {
    const stream = await mic.start();
    if (!stream || !topic) return;

    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, topicId: topic.id }),
      });
    } catch {
      // The conversation matters more than the bookkeeping.
    }

    recorder.start(stream);
    setHasStarted(true);
    setStartedAt(Date.now());
    speak(turns[0]);
  }, [mic, topic, sessionId, recorder, speak, turns]);

  const end = useCallback(async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    window.speechSynthesis?.cancel();

    if (recorder.status === "recording") {
      await recorder.stopAndUpload(sessionId, profileId);
    } else {
      recorder.discard();
    }
    router.push(`/practice/report/${sessionId}`);
  }, [recorder, sessionId, profileId, router]);

  useEffect(() => {
    if (startedAt === null) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSecondsRemaining(Math.max(0, SESSION_SECONDS - elapsed));
    }, 500);

    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    if (!hasStarted || secondsRemaining > 0) return;
    const timer = setTimeout(() => void end(), 0);
    return () => clearTimeout(timer);
  }, [hasStarted, secondsRemaining, end]);

  const nextTurn = useCallback(() => {
    const next = turnIndex + 1;
    if (next >= turns.length) {
      void end();
      return;
    }
    setTurnIndex(next);
    speak(turns[next]);
  }, [turnIndex, turns, speak, end]);

  if (error) {
    return (
      <Card className="p-6">
        <p className="t-title-3 mb-2">Couldn&rsquo;t start</p>
        <p className="t-body mb-5 text-ink-muted">{error}</p>
        <Button variant="secondary" onClick={() => router.push("/practice")}>
          Back
        </Button>
      </Card>
    );
  }

  if (!topic) {
    return (
      <Card className="p-6">
        <p className="t-title-3">Getting a topic…</p>
      </Card>
    );
  }

  if (!hasStarted) {
    return (
      <div className="flex flex-1 flex-col">
        <Badge tone="warn" className="mb-5 self-start">
          Practising with the AI, not a person
        </Badge>

        <h1 className="t-title-1 mb-2">Nobody free right now</h1>
        <p className="t-body mb-8 text-ink-muted">
          Same topic, same timer, same report at the end. It just isn&rsquo;t a
          person, and we&rsquo;d rather say so than pretend.
        </p>

        <Card tone="topic" className="mb-8 p-6 pl-7">
          <p className="t-micro mb-3 text-ink-muted">Your topic</p>
          <p className="t-title-2">{topic.prompt}</p>
        </Card>

        <Button variant="primary" size="lg" isBlock onClick={() => void start()}>
          Start talking
        </Button>
        {mic.errorMessage ? (
          <p className="t-caption mt-3 text-danger">{mic.errorMessage}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LiveDot />
          <Badge tone="warn">AI partner</Badge>
        </div>
        <span className="t-timer">{formatClock(secondsRemaining)}</span>
      </header>

      <Card tone="topic" className="mb-6 p-6 pl-7">
        <p className="t-micro mb-3 text-ink-muted">Topic</p>
        <p className="t-title-2">{topic.prompt}</p>
      </Card>

      <Card className="mb-6 p-5">
        <p className="t-micro mb-2 text-ink-muted">
          {isSpeaking ? "Speaking" : "Listening"}
        </p>
        <p className="t-body-lg">{turns[turnIndex]}</p>
      </Card>

      <Card tone="sunken" className="mb-6 flex items-center gap-4 p-4">
        <div className="flex h-10 w-16 shrink-0 items-center justify-center text-accent-bright">
          <Waveform levels={mic.levels} className="h-8" />
        </div>
        <p className="t-label">You</p>
      </Card>

      <div className="mt-auto flex items-center gap-3 border-t border-hairline pt-4">
        <Button variant="secondary" size="lg" onClick={nextTurn}>
          I&rsquo;ve answered
        </Button>
        <Button
          variant="danger-ghost"
          size="lg"
          className="ml-auto"
          onClick={() => void end()}
        >
          Finish
        </Button>
      </div>
    </div>
  );
}
