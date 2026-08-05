import { computeMetrics } from "@/lib/metrics/compute";
import type { SpeechMetrics, Transcript } from "@/lib/metrics/types";
import { MIN_TALK_SHARE, MIN_VOICED_SECONDS } from "@/lib/domain";
import { deleteAudio } from "@/lib/store/audio";
import {
  getSession,
  listSessions,
  saveReport,
  updateSession,
} from "@/lib/store/demo-store";
import { ERROR_TYPES, scoreWithLlm, type RubricResult } from "./llm";
import { transcribe } from "./stt";
import { TRAITS, type Correction, type ErrorType, type Report } from "./types";

/** Below this the recogniser was unsure, so a "correction" is likely its error. */
const MIN_WORD_CONFIDENCE = 0.6;

/** How long to wait for the other side's upload before scoring without it. */
const PARTNER_AUDIO_GRACE_MS = 25_000;

function transcriptText(transcript: Transcript): string {
  return transcript.utterances
    .map((utterance) =>
      utterance.words.map((word) => word.punctuated ?? word.word).join(" "),
    )
    .join("\n");
}

/**
 * Mean confidence across the words a quoted phrase covers.
 *
 * A learner told they made a mistake they did not make will not come back, and
 * heavily accented speakers collect disproportionately many of those. That
 * makes this a fairness guard, not just a quality one.
 */
function confidenceOf(transcript: Transcript, phrase: string): number {
  const target = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  if (target.length === 0) return 0;

  const words = transcript.utterances.flatMap((utterance) => utterance.words);

  for (let i = 0; i + target.length <= words.length; i += 1) {
    const window = words.slice(i, i + target.length);
    const matches = window.every(
      (word, index) => word.word.toLowerCase() === target[index],
    );
    if (!matches) continue;

    return (
      window.reduce((total, word) => total + word.confidence, 0) / window.length
    );
  }

  return 0;
}

function timestampOf(transcript: Transcript, phrase: string): number {
  const target = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  const words = transcript.utterances.flatMap((utterance) => utterance.words);

  for (let i = 0; i + target.length <= words.length; i += 1) {
    const matches = words
      .slice(i, i + target.length)
      .every((word, index) => word.word.toLowerCase() === target[index]);
    if (matches) return Math.round(words[i].start * 1000);
  }
  return 0;
}

function asErrorType(value: string): ErrorType {
  return ERROR_TYPES.includes(value as ErrorType)
    ? (value as ErrorType)
    : "OTHER";
}

/**
 * Turns a model's proposed correction into one we are willing to show.
 *
 * Two hard guards. The verbatim check is the single most effective defence
 * against hallucination — models are fond of inventing plausible learner
 * errors that were never said. The confidence check stops us correcting the
 * transcriber's mistakes and blaming the learner for them.
 */
function validateCorrection(
  transcript: Transcript,
  raw: { original: string; corrected: string; errorType: string; rule: string },
  fullText: string,
): Correction | null {
  const original = raw.original?.trim();
  if (!original || !raw.corrected?.trim() || !raw.rule?.trim()) return null;

  if (!fullText.toLowerCase().includes(original.toLowerCase())) return null;
  if (confidenceOf(transcript, original) < MIN_WORD_CONFIDENCE) return null;

  const occurrences =
    fullText.toLowerCase().split(original.toLowerCase()).length - 1;

  return {
    original,
    corrected: raw.corrected.trim(),
    errorType: asErrorType(raw.errorType),
    rule: raw.rule.trim(),
    timestampMs: timestampOf(transcript, original),
    occurrences,
  };
}

function buildTraits(result: RubricResult, metrics: SpeechMetrics) {
  return TRAITS.map((trait) => {
    const found = result.traits?.find((t) => t.key === trait.key);
    let score = Math.max(0, Math.min(100, Math.round(found?.score ?? 50)));

    /*
     * Interaction is capped for a monologue. Doing 90% of the talking is not
     * a good conversation however well the sentences were formed — and this
     * is the trait no solo-practice app can score at all, so it is worth
     * getting right.
     */
    if (
      trait.key === "interaction" &&
      metrics.talkShare !== null &&
      metrics.talkShare > 0.75
    ) {
      score = Math.min(score, 55);
    }

    return {
      key: trait.key,
      score,
      comment: found?.comment?.trim() || trait.blurb,
    };
  });
}

export type ScoreOutcome =
  | { status: "scored"; report: Report }
  | { status: "skipped"; reason: string };

/**
 * Scores ONE participant from their own recording.
 *
 * Each person is scored only from their own track. Their partner cannot help
 * or hurt them, which removes most of the value in colluding and makes the
 * number mean something on its own.
 */
export async function scoreParticipant(
  sessionId: string,
  profileId: string,
): Promise<ScoreOutcome> {
  const session = await getSession(sessionId);
  if (!session) return { status: "skipped", reason: "no-such-session" };

  const me = session.participants.find((p) => p.profileId === profileId);
  if (!me?.audioKey) return { status: "skipped", reason: "no-audio" };

  const partner = session.participants.find((p) => p.profileId !== profileId);

  /*
   * Talk share needs the partner's track, and whoever hangs up first arrives
   * here before the other side has finished uploading. Interaction is the one
   * trait no solo-practice app can measure at all, so it is worth a short
   * wait — but not an unbounded one. After the window, score without it and
   * report talk share as unknown rather than leaving someone with no report.
   */
  if (partner && !partner.audioKey) {
    const startedAgo = Date.now() - new Date(session.startedAt).getTime();
    const endedAgo = session.endedAt
      ? Date.now() - new Date(session.endedAt).getTime()
      : startedAgo;

    if (endedAgo < PARTNER_AUDIO_GRACE_MS) {
      return { status: "skipped", reason: "waiting-for-partner-audio" };
    }
  }

  const transcript = await transcribe(me.audioKey);

  // The partner's voiced time is needed for talk share. If their side never
  // arrived, talk share stays null rather than being guessed at.
  let partnerVoicedSeconds: number | undefined;
  if (partner?.audioKey) {
    const partnerTranscript = await transcribe(partner.audioKey);
    partnerVoicedSeconds = partnerTranscript.utterances.reduce(
      (total, utterance) => total + (utterance.end - utterance.start),
      0,
    );
  }

  const metrics = computeMetrics(transcript, { partnerVoicedSeconds });
  const text = transcriptText(transcript);

  const failedFloor = checkFloors(metrics);
  if (failedFloor) {
    const report = unscoredReport(sessionId, profileId, metrics, failedFloor);
    await saveReport(report);
    await finish(sessionId);
    return { status: "scored", report };
  }

  const { result, isDemo } = await scoreWithLlm(text, metrics, me.levelBand);

  const improvement = result.improvement
    ? validateCorrection(transcript, result.improvement, text)
    : null;

  const otherCorrections = (result.otherCorrections ?? [])
    .map((raw) => validateCorrection(transcript, raw, text))
    .filter((correction): correction is Correction => correction !== null);

  const traits = buildTraits(result, metrics);
  const total = Math.round(
    traits.reduce((sum, trait) => sum + trait.score, 0) / traits.length,
  );

  const strengthQuote = result.strength?.quote?.trim() ?? "";
  const hasStrengthQuote =
    strengthQuote.length > 0 &&
    text.toLowerCase().includes(strengthQuote.toLowerCase());

  const report: Report = {
    sessionId,
    profileId,
    createdAt: new Date().toISOString(),
    isScored: true,
    unscoredReason: null,
    metrics,
    band: result.band ?? null,
    total,
    traits,
    strength: hasStrengthQuote
      ? {
          quote: strengthQuote,
          timestampMs: timestampOf(transcript, strengthQuote),
          detail: result.strength?.detail?.trim() ?? "",
        }
      : null,
    improvement,
    otherCorrections,
    nextGoal: result.nextGoal?.trim() || null,
    isDemo,
  };

  await saveReport(report);
  await finish(sessionId);
  return { status: "scored", report };
}

/**
 * Floors. The answer below them is "not enough speech to assess", never a low
 * score — if silence produced a bad number, the way to protect your average
 * would be to stop talking.
 */
function checkFloors(metrics: SpeechMetrics): string | null {
  if (metrics.voicedSeconds < MIN_VOICED_SECONDS) {
    return "not-enough-speech";
  }
  if (metrics.talkShare !== null && metrics.talkShare < MIN_TALK_SHARE) {
    return "not-enough-of-the-conversation";
  }
  return null;
}

function unscoredReport(
  sessionId: string,
  profileId: string,
  metrics: SpeechMetrics,
  reason: string,
): Report {
  return {
    sessionId,
    profileId,
    createdAt: new Date().toISOString(),
    isScored: false,
    unscoredReason: reason,
    metrics,
    band: null,
    total: null,
    traits: [],
    strength: null,
    improvement: null,
    otherCorrections: [],
    nextGoal: null,
    isDemo: !process.env.ANTHROPIC_API_KEY,
  };
}

/**
 * Audio survives the report by 24 hours, then goes.
 *
 * Two rules pulling opposite ways. Replaying the exact moment you made a
 * mistake, in your own voice, is the most useful thing in the report and
 * almost nobody does it — that needs the audio. But recording without
 * deleting is how a practice app quietly becomes a surveillance archive.
 *
 * A day is long enough to read your report and short enough that nothing
 * accumulates. Purging is opportunistic (see purgeExpiredAudio) rather than
 * scheduled, so there is no cron to forget to deploy.
 */
const AUDIO_RETENTION_MS = 24 * 60 * 60 * 1000;

async function finish(sessionId: string): Promise<void> {
  await updateSession(sessionId, {
    status: "scored",
    audioExpiresAt: new Date(Date.now() + AUDIO_RETENTION_MS).toISOString(),
  });
}

/**
 * Deletes audio whose retention window has closed.
 *
 * Called when someone opens a report, which is both the moment the data is
 * least likely to be needed again and a guaranteed trigger. A missed purge
 * means audio outliving its promise, so it must not depend on a scheduler.
 */
export async function purgeExpiredAudio(): Promise<number> {
  const sessions = await listSessions();
  const now = Date.now();
  let purged = 0;

  for (const session of sessions) {
    if (!session.audioExpiresAt) continue;
    if (new Date(session.audioExpiresAt).getTime() > now) continue;

    for (const participant of session.participants) {
      if (!participant.audioKey) continue;
      await deleteAudio(participant.audioKey);
      purged += 1;
    }

    await updateSession(session.id, {
      audioExpiresAt: null,
      participants: session.participants.map((p) => ({ ...p, audioKey: null })),
    });
  }

  return purged;
}
